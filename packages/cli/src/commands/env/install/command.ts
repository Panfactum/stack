import { Command } from "clipanion";
import { addAWSProfileFromStaticCreds } from "@/util/aws/addAWSProfileFromStaticCreds";
import { PanfactumCommand } from "@/util/command/panfactumCommand";
import { getEnvironments } from "@/util/config/getEnvironments";
import { bootstrapEnvironment } from "./bootstrapEnvironment";
import { getEnvironmentName } from "./getEnvironmentName";
import { getNewAccountAdminAccess } from "./getNewAccountAdminAccess";
import { getRootAccountAdminAccess } from "./getRootAccountAdminAccess";
import { hasExistingAWSInfra } from "./hasExistingAWSInfra";
import { hasExistingAWSOrg } from "./hasExistingAWSOrg";
import { provisionAWSAccount } from "./provisionAWSAccount";
import { shouldCreateAWSOrg } from "./shouldCreateAWSOrg";
import { shouldPanfactumManageAWSOrg } from "./shouldPanfactumManageAWSOrg";
import { updateIAMIdentityCenter } from "./updateIAMIdentityCenter";


const DEFAULT_MANAGEMENT_PROFILE =  "management-superuser"

export class EnvironmentInstallCommand extends PanfactumCommand {
    static override paths = [["env", "install"]];

    static override usage = Command.Usage({
        description: "Install a Panfactum environment",
        details:
            "Executes a guided installation of a Panfactum environment",
    });

    async execute() {
        const {context} = this

        const existingEnvs = await getEnvironments(context);
        let hasManagementEnv = existingEnvs.findIndex(env => env.name === "management") !== -1;
        let hasAWSOrg = false;

        let managementAccountCreds: {secretAccessKey: string, accessKeyId: string} | undefined;
        if (existingEnvs.length === 0) {

            //////////////////////////////////////////////////////////////////////////////////////////
            // If the user does not have existing environments, then we can assume this is their first time
            // setting up Panfactum, so we attempt to guide them through the initial AWS setup
            // and connect their AWS management account to the Panfactum framework so that we
            // can provide improved automation.
            //
            // However, they can also opt-out of this and continue to use standalone AWS accounts
            //////////////////////////////////////////////////////////////////////////////////////////
            context.logger.log(
                `It looks like you are installing your first Panfactum environment!\n` +
                `There will be a few preliminary questions to ensure that setup goes smoothly...`,
                {trailingNewlines: 1, leadingNewlines: 1}
            )
            if(await hasExistingAWSInfra(context)){
                if (await hasExistingAWSOrg(context)) {
                    hasAWSOrg = true
                    if(await shouldPanfactumManageAWSOrg(context)){
                        managementAccountCreds = await getRootAccountAdminAccess(context)
                    }
                } else {
                    context.logger.log(
                        `Got it! Panfactum uses AWS Organizations to create AWS accounts for your environments.\n` +
                        `We will need to set that up first.`,
                        {trailingNewlines: 1, leadingNewlines: 1}
                    )
                    managementAccountCreds = await getNewAccountAdminAccess({context, type: "management"})
                }
            } else {
                context.logger.log(
                    `Got it! Since you are using Panfactum for the first time, let's create an AWS Organization\n` +
                    `to manage the AWS accounts for the environments that you create.`,
                    {trailingNewlines: 1, leadingNewlines: 1}
                )
                managementAccountCreds = await getNewAccountAdminAccess({context, type: "management"})
            }
        } else if(!hasManagementEnv){

            //////////////////////////////////////////////////////////////////////////////////////////
            // If the user has environments, but not a management environment, we should continue
            // to reprompt them to create it and remind them that not allowing Panfactum to manage
            // the entire AWS organization may result in unexpected bevaior.
            //
            // However, we still let them opt-out of this.
            //////////////////////////////////////////////////////////////////////////////////////////
            if(await hasExistingAWSOrg(context)){
                hasAWSOrg = true
                if(await shouldPanfactumManageAWSOrg(context)){
                    managementAccountCreds = await getRootAccountAdminAccess(context)
                }
            } else if(await shouldCreateAWSOrg(context)){
                managementAccountCreds = await getNewAccountAdminAccess({context, type: "management"})
            }
        }

        ////////////////////////////////////////////////////////////////
        // If we have management creds at this point, that means that the user
        // has indicated that they want Panfactum to connect to and manage their
        // AWS management account
        ////////////////////////////////////////////////////////////////
        if (managementAccountCreds) {
            await addAWSProfileFromStaticCreds({
                context,
                creds: managementAccountCreds,
                profile: DEFAULT_MANAGEMENT_PROFILE
            })
            await bootstrapEnvironment({
                context,
                environmentProfile: DEFAULT_MANAGEMENT_PROFILE,
                environmentName: "management"
            })
            hasManagementEnv = true;
            hasAWSOrg = true
        }

        ////////////////////////////////////////////////////////////////
        // Get the name of the environment that the user wants to create
        ////////////////////////////////////////////////////////////////
        const environmentName = await getEnvironmentName({context});
        const environmentProfile = `${environmentName}-superuser`

        ////////////////////////////////////////////////////////////////
        // Create the AWS account, setup the environment files in the repo
        // and create the foundational AWS resources for using IaC
        // such as the state bucket and account aliases
        // 
        //  (a) If the Panfactum install has a management environment, that means
        //  that they are using Panfactum to manage their AWS organization
        //  so we can use that to automatically provision their environment
        //
        //  (b) If not, then we need to take them through the manual setup steps
        ////////////////////////////////////////////////////////////////
        
        if (hasManagementEnv) {
            // Note that 'provisionAWSAccount' leverages the AWS Organization to create the account.
            // If the AWS Organization is not set up yet, it also takes care of that process.
            await provisionAWSAccount({context, environmentName, environmentProfile})
        } else {
            // Otherwise, they need to manually create the account, the 'AdministratorAccess'
            // IAM user, and the access credentials to provide the installer
             await getNewAccountAdminAccess({
                context,
                type: hasAWSOrg ? "manual-org" : "standalone",
                environmentProfile
            })
        }

        await bootstrapEnvironment({
            context,
            environmentProfile,
            environmentName
        })


        // ////////////////////////////////////////////////////////////////
        // // Connect the accunt to their Panfactum-managed AWS SSO system
        // // if they have installed it.
        // //
        // // This allows us to replace their static credentials
        // // with an SSO login flow for improved security and user-ergonomics
        // ////////////////////////////////////////////////////////////////
        if(hasManagementEnv){
            await updateIAMIdentityCenter({
                context,
                environmentProfile,
                environmentName
            })
        }
    }
}


