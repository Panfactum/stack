import { join } from "node:path";
import { Command } from "clipanion";
import pc from "picocolors"
import { addAWSProfileFromStaticCreds } from "@/util/aws/addAWSProfileFromStaticCreds";
import { getAWSProfiles } from "@/util/aws/getAWSProfiles";
import { PanfactumCommand } from "@/util/command/panfactumCommand";
import { getEnvironments } from "@/util/config/getEnvironments";
import { CLIError } from "@/util/error/error";
import { getLastPathSegments } from "@/util/fs/getLastPathSegments";
import { getRelativeFromRoot } from "@/util/fs/getRelativeFromRoot";
import { GLOBAL_REGION, MANAGEMENT_ENVIRONMENT, MODULES } from "@/util/terragrunt/constants";
import { getModuleStatus } from "@/util/terragrunt/getModuleStatus";
import { bootstrapEnvironment } from "./bootstrapEnvironment";
import { checkAdminPermissions } from "./checkAdminPermissions";
import { getEnvironment } from "./getEnvironment";
import { getNewAccountAdminAccess } from "./getNewAccountAdminAccess";
import { getRootAccountAdminAccess } from "./getRootAccountAdminAccess";
import { hasExistingAWSOrg } from "./hasExistingAWSOrg";
import { provisionAWSAccount } from "./provisionAWSAccount";
import { shouldCreateAWSOrg } from "./shouldCreateAWSOrg";
import { shouldPanfactumManageAWSOrg } from "./shouldPanfactumManageAWSOrg";
import { updateIAMIdentityCenter } from "./updateIAMIdentityCenter";
import { isEnvironmentDeployed } from "../../../util/config/isEnvironmentDeployed";

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
        context.logger.addIdentifier(MANAGEMENT_ENVIRONMENT)

        const existingEnvs = await getEnvironments(context);
        let _hasExistingAWSOrg = false;
        let _hasDeployedAWSOrg = await isEnvironmentDeployed({ context, environment: MANAGEMENT_ENVIRONMENT })
        let _hasManagementProfile = (await getAWSProfiles(context)).includes(DEFAULT_MANAGEMENT_PROFILE)
        let _resumingManagementSetup = false;
        let managementAccountCreds: { secretAccessKey: string, accessKeyId: string } | undefined;
        context.logger.line()

        if (_hasManagementProfile && !_hasDeployedAWSOrg) {
            //////////////////////////////////////////////////////////////////////////////////////////
            // If the user has an AWS profile set for the management environment, but the
            // AWS organizaiton wasn't deployed, then we need to resume the management environment setup
            //////////////////////////////////////////////////////////////////////////////////////////
            context.logger.info(`
                It looks like you were in the middle of deploying your AWS Organization in the
                ${MANAGEMENT_ENVIRONMENT} environment. Resuming the deployment...
            `)
            _resumingManagementSetup = true
        } else if (existingEnvs.length === 0) {

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
            if (await hasExistingAWSOrg(context)) {
                _hasExistingAWSOrg = true
                if (await shouldPanfactumManageAWSOrg(context)) {
                    managementAccountCreds = await getRootAccountAdminAccess(context)
                }
            } else {
                context.logger.info(`
                    Got it! Panfactum uses AWS Organizations to create AWS accounts for your Panfactum environments.
                    We will need to set that up before creating environments for your workloads.

                    After the AWS Organization is deployed, you can transfer any existing AWS accounts into that Organization
                    to allow for easier access and centralized configuration.
                    
                    The AWS Organization will live in a special Panfactum environment called ${MANAGEMENT_ENVIRONMENT}. 
                `)
                managementAccountCreds = await getNewAccountAdminAccess({
                    context,
                    type: "management",
                    environment: MANAGEMENT_ENVIRONMENT
                })
            }
        } else if (!_hasDeployedAWSOrg) {

            //////////////////////////////////////////////////////////////////////////////////////////
            // If the user has environments, but not a management environment, we should continue
            // to reprompt them to create it and remind them that not allowing Panfactum to manage
            // the entire AWS organization may result in unexpected bevaior.
            //
            // However, we still let them opt-out of this.
            //////////////////////////////////////////////////////////////////////////////////////////
            if (await hasExistingAWSOrg(context)) {
                _hasExistingAWSOrg = true
                if (await shouldPanfactumManageAWSOrg(context)) {
                    managementAccountCreds = await getRootAccountAdminAccess(context)
                }
            } else if (await shouldCreateAWSOrg(context)) {
                managementAccountCreds = await getNewAccountAdminAccess({
                    context,
                    type: "management",
                    environment: MANAGEMENT_ENVIRONMENT
                })
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
            _hasManagementProfile = true
        }

        if (_hasManagementProfile && !_hasDeployedAWSOrg) {

            // If the user is resuming the installation of the management environment,
            // then it is possible that they messed with the AWS profile or credentials
            // and broke them, so we need to validate that they work
            const checkStatus = await checkAdminPermissions({ context, profile: DEFAULT_MANAGEMENT_PROFILE })
            const awsConfigFile = join(context.repoVariables.aws_dir, "config")
            if (checkStatus.status === "missingAdministratorAccess") {
                context.logger.error(`
                    The AWS profile ${DEFAULT_MANAGEMENT_PROFILE} in ${awsConfigFile}
                    does not have access the AdministratorAccess policy directly attached.

                    Please attach the AdministratorAccess policy to the ${checkStatus.username}
                    IAM user in the AWS account ${checkStatus.accountId} and re-run this command.
                `, { highlights: [DEFAULT_MANAGEMENT_PROFILE, awsConfigFile, checkStatus.username ?? "", checkStatus.accountId ?? "", "AdministratorAccess"] })
                throw new CLIError(`The ${DEFAULT_MANAGEMENT_PROFILE} AWS profile does not have the AdministratorAccess policy.`)
            } else if (checkStatus.status === "invalidCredentials") {
                const credentialsFile = join(context.repoVariables.aws_dir, "credentials")
                context.logger.error(`
                    The AWS profile ${DEFAULT_MANAGEMENT_PROFILE} in ${awsConfigFile}
                    does not have valid credentials.

                    Please provide a valid AWS access key ID and secret access key in the credentials file
                    at ${credentialsFile} and re-run this command.
                `, { highlights: [DEFAULT_MANAGEMENT_PROFILE, awsConfigFile, credentialsFile] })
                throw new CLIError(`The ${DEFAULT_MANAGEMENT_PROFILE} AWS profile does not have valid credentials.`)
            } else if (checkStatus.status === "invalidUsername") {
                context.logger.error(`
                    The AWS profile ${DEFAULT_MANAGEMENT_PROFILE} in ${awsConfigFile}
                    does not appear to be associated with a real IAM user.

                    Please connect the profile to an IAM user with the AdministratorAccess policy directly attached.
                `, { highlights: [DEFAULT_MANAGEMENT_PROFILE, awsConfigFile] })
                throw new CLIError(`The ${DEFAULT_MANAGEMENT_PROFILE} AWS profile is not associated with a valid IAM user.`)
            }

            // Create the environment (which also creates the AWS organization)
            await bootstrapEnvironment({
                context,
                environmentProfile: DEFAULT_MANAGEMENT_PROFILE,
                environmentName: MANAGEMENT_ENVIRONMENT,
                resuming: _resumingManagementSetup
            })
            _hasDeployedAWSOrg = true

            // FIX: This does not properly handle the case where the user has existing
            // environments were created WITHOUT an AWS organization. Those need to be
            // imported.

            const managementFolder = getLastPathSegments(join(context.repoVariables.environments_dir, MANAGEMENT_ENVIRONMENT), 2)
            context.logger.success(`
                The AWS Organization has now been configured and its settings are 
                stored in the ${MANAGEMENT_ENVIRONMENT} environment (${managementFolder}). The ${MANAGEMENT_ENVIRONMENT}
                environment is a ${pc.italic("special")} environment used for storing global
                settings that transcend normal environment boundaries.

                Any existing AWS accounts can be added to the new AWS Organizationby following this guide:
                https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_accounts_invite-account.html

                However, this is not required to continue adding a new environment.

                We can now proceed to adding a new standard Panfactum environment. Note that the bootstrapping
                process will look similar to the ${MANAGEMENT_ENVIRONMENT} environment, but we will be
                able to automate many steps.
            `, { highlights: [managementFolder] })
        }

        ////////////////////////////////////////////////////////////////
        // Get the name of the environment that the user wants to create
        ////////////////////////////////////////////////////////////////
        const { name: environmentName, partiallyDeployed } = await getEnvironment({ context });
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
        let newAccountName: string | undefined;
        let alreadyProvisioned = false;
        if (_hasDeployedAWSOrg) {
            // Note that 'provisionAWSAccount' leverages the AWS Organization to create the account.
            // If the AWS Organization is not set up yet, it also takes care of that process.
            ({ newAccountName, alreadyProvisioned } = await provisionAWSAccount({ context, environmentName, environmentProfile }))
        } else {

            // First check if they already completed this step by verifying if the profile
            // exists with the expected credentials
            const existingProfiles = await getAWSProfiles(context)
            if (existingProfiles.includes(environmentProfile)) {
                const permissionStatus = await checkAdminPermissions({ context, profile: environmentProfile })
                if (permissionStatus.status === "success") {
                    context.logger.success(`AWS account for the ${environmentName} environment was already provisioned.`)
                    alreadyProvisioned = true
                }
            }

            // Otherwise, they need to manually create the account, the 'AdministratorAccess'
            // IAM user, and the access credentials to provide the installer
            if (!alreadyProvisioned) {
                const newAccountCreds = await getNewAccountAdminAccess({
                    context,
                    type: _hasExistingAWSOrg ? "manual-org" : "standalone",
                    environment: environmentName
                })
                await addAWSProfileFromStaticCreds({
                    context,
                    creds: newAccountCreds,
                    profile: environmentProfile
                })
            }
        }

        const resumingBootstrapping = alreadyProvisioned && partiallyDeployed
        if (resumingBootstrapping) {
            context.logger.info(`The AWS account for ${environmentName} was partially bootstrapped. Resuming...`)
        }
        await bootstrapEnvironment({
            context,
            environmentProfile,
            environmentName,
            newAccountName,
            resuming: resumingBootstrapping
        })


        // ////////////////////////////////////////////////////////////////
        // // Connect the accunt to their Panfactum-managed AWS SSO system
        // // if they have installed it.
        // //
        // // This allows us to replace their static credentials
        // // with an SSO login flow for improved security and user-ergonomics
        // ////////////////////////////////////////////////////////////////
        if ((await getModuleStatus({
            context,
            environment: MANAGEMENT_ENVIRONMENT,
            region: GLOBAL_REGION,
            module: MODULES.AWS_IAM_IDENTITY_CENTER_PERMISSIONS
        })).deploy_status === "success") {
            await updateIAMIdentityCenter({
                context,
                environmentProfile,
                environmentName
            })
        }

        const newDirectory = getRelativeFromRoot(context, join(context.repoVariables.environments_dir, environmentName))
        context.logger.success(`
            The ${environmentName} environment has been successfully set up.
            
            Its infrastructure-as-code lives at ${newDirectory}.

            You will receive several automated emails from AWS
            as this installer has automatically requested many common
            AWS quota increases. No action is necessary.

            You can access the underlying AWS account through the AWS CLI: 
            
               aws --profile ${environmentProfile} sts get-caller-identity

            We recommend the next steps:

               1. Add a domain: pf domain add -e ${environmentName}

               2. Add a cluster to begin deploying workloads: pf cluster add
        `, {
            highlights: [
                newDirectory,
                `pf domain add -e ${environmentName}`,
                "pf cluster add",
                `aws --profile ${environmentProfile} sts get-caller-identity`
            ]
        })

    }
}


