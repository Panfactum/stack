import { Command } from "clipanion";
import pc from "picocolors"
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

const DEFAULT_MANAGEMENT_PROFILE = "management-superuser"

export class EnvironmentInstallCommand extends PanfactumCommand {
    static override paths = [["env", "add"]];

    static override usage = Command.Usage({
        description: "Adds an environment to the Panfactum framework installation",
        details: `
        Adds an environment to the Panfactum framework installation.

        In Panfactum, ${pc.italic("environments")} are the top-level container for user
        workloads. 
        
        Environments serve as a strict isolation boundary for workloads. Workloads in different
        environments cannot interact with one another. Nothing that happens in one environment
        will be able to impact any other environment.

        Environment also serve as the primary target for access control rules. By default,
        user roles are environment-scoped. In other words, a user with superuser access to
        an environment will automatically have superuser access to all workloads in the environment
        such as Kubernetes clusters, databases, obervability platforms, etc.

        Infrastructure-as-Code =========================================================

        In Panfactum, ${pc.italic("every")} piece of infrastructure is controlled
        by infrastructure-as-code that is completely transparent and accessible to you --
        there is no magic or blackbox abstraction.

        Panfactum uses OpenTofu (the open-source Terraform fork) to define infrastructure modules
        and Terragrunt to deploy them.

        Terragrunt provides the necessary configuration tools to make deploying and managing
        IaC modules easy, and Panfactum does all of the necessary best-practice scaffholding to get you
        up and running in a matter of minutes.

        Ultimately, this installer will add the infrastructure-as-code for a new environment.
        To see what that will look like, see the Panfactum reference-infrastructure repository:
        https://github.com/Panfactum/reference-infrastructure/tree/main/environments

        Recommended Setup ==============================================================

        For those just starting out, we recommend creating a ${pc.blue("production")}
        environment for hosting your initial workloads.

        As you begin to serve real users, we adding a ${pc.blue("development")}
        environment. This allows you have one environment for testing
        changes and another for serving real traffic.

        As your team grows, you can add additional environments as necessary.

        Note that this installer may attempt you to create a special environment: ${pc.blue("management")}.
        This environment is used to manage organization-wide settings,
        such as cloud-provider billing information or global access control policies. Workloads cannot
        be deployed to the management environment.

        Regions ========================================================================

        Environments contain ${pc.italic("regions")} which are the second-level container
        for user workloads. 
        
        Conceptually, regions represent different "datacenters" in your environment. In the
        Panfactum framework, every region has at most one Panfactum Kubernetes cluster which
        is the primary system for running your workloads. You can also have regions without
        live clusters for resources like cold backups.

        For workloads that talk with one another, you will likely want to deploy all these
        workloads to the same region. All workloads must be deployed to a region.

        Every environment has a special region called ${pc.blue("global")} which is for
        infrastructure resources that are environment-scoped, but not region-scoped. These
        include access control policies, domains, etc.

        AWS Installations ==============================================================

        For AWS installations, environments have a one-to-one relationship
        with AWS accounts. Environments are virtually free and generally fall within the AWS
        free tier.

        Additionally, Panfactum regions will have a many-to-one correspondence to AWS regions.
        In other words, every Panfactum region deploys to exactly one AWS region, but you
        can have multiple Panfactum regions deploying to the same AWS region. This can be
        helpful if you need to deploy multiple Panfactum clusters to the same AWS region.
        `
    });

    async execute() {
        const { context } = this

        const existingEnvs = await getEnvironments(context);
        let hasManagementEnv = existingEnvs.findIndex(env => env.name === "management") !== -1;
        let hasAWSOrg = false;

        let managementAccountCreds: { secretAccessKey: string, accessKeyId: string } | undefined;
        if (existingEnvs.length === 0) {

            //////////////////////////////////////////////////////////////////////////////////////////
            // If the user does not have existing environments, then we can assume this is their first time
            // setting up Panfactum, so we attempt to guide them through the initial AWS setup
            // and connect their AWS management account to the Panfactum framework so that we
            // can provide improved automation.
            //
            // However, they can also opt-out of this and continue to use standalone AWS accounts
            //////////////////////////////////////////////////////////////////////////////////////////
            context.logger.info(`
               It looks like you are installing your first Panfactum environment!
               There will be a few preliminary questions to ensure that setup goes smoothly...
            `)
            if (await hasExistingAWSInfra(context)) {
                if (await hasExistingAWSOrg(context)) {
                    hasAWSOrg = true
                    if (await shouldPanfactumManageAWSOrg(context)) {
                        managementAccountCreds = await getRootAccountAdminAccess(context)
                    }
                } else {
                    context.logger.info(`
                        Got it! Panfactum uses AWS Organizations to create AWS accounts for your environments.
                        We will need to set that up first.
                    `)
                    managementAccountCreds = await getNewAccountAdminAccess({ context, type: "management" })
                }
            } else {
                context.logger.info(`
                    Got it! Since you are using Panfactum for the first time, let's create an AWS Organization
                    to manage the AWS accounts for the environments that you create.
                `)
                managementAccountCreds = await getNewAccountAdminAccess({ context, type: "management" })
            }
        } else if (!hasManagementEnv) {

            //////////////////////////////////////////////////////////////////////////////////////////
            // If the user has environments, but not a management environment, we should continue
            // to reprompt them to create it and remind them that not allowing Panfactum to manage
            // the entire AWS organization may result in unexpected bevaior.
            //
            // However, we still let them opt-out of this.
            //////////////////////////////////////////////////////////////////////////////////////////
            if (await hasExistingAWSOrg(context)) {
                hasAWSOrg = true
                if (await shouldPanfactumManageAWSOrg(context)) {
                    managementAccountCreds = await getRootAccountAdminAccess(context)
                }
            } else if (await shouldCreateAWSOrg(context)) {
                managementAccountCreds = await getNewAccountAdminAccess({ context, type: "management" })
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
        const environmentName = await getEnvironmentName({ context });
        const environmentProfile = `${environmentName}-superuser`
        context.logger.addIdentifier(environmentName)

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
            await provisionAWSAccount({ context, environmentName, environmentProfile })
        } else {
            // Otherwise, they need to manually create the account, the 'AdministratorAccess'
            // IAM user, and the access credentials to provide the installer
            const newAccountCreds = await getNewAccountAdminAccess({
                context,
                type: hasAWSOrg ? "manual-org" : "standalone"
            })
            await addAWSProfileFromStaticCreds({
                context,
                creds: newAccountCreds,
                profile: environmentProfile
            })
        }

        // TODO: Pass through the actual account name
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
        if (hasManagementEnv) {
            await updateIAMIdentityCenter({
                context,
                environmentProfile,
                environmentName
            })
        }
    }
}


