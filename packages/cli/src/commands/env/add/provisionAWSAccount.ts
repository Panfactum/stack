import { join } from "node:path"
import { CreateUserCommand, AttachUserPolicyCommand, CreateAccessKeyCommand, IAMClient } from "@aws-sdk/client-iam";
import { CreateAccountCommand, DescribeCreateAccountStatusCommand, ListAccountsCommand, OrganizationsClient } from "@aws-sdk/client-organizations";
import { AssumeRoleCommand } from "@aws-sdk/client-sts";
import { Listr } from "listr2";
import { z } from "zod";
import { addAWSProfileFromStaticCreds } from "@/util/aws/addAWSProfileFromStaticCreds";
import { getOrganizationsClient } from "@/util/aws/clients/getOrganizationsClient";
import { getSTSClient } from "@/util/aws/clients/getSTSClient";
import { getAWSProfiles } from "@/util/aws/getAWSProfiles";
import { getIdentity } from "@/util/aws/getIdentity";
import { getPanfactumConfig } from "@/util/config/getPanfactumConfig";
import { CLIError } from "@/util/error/error";
import { directoryExists } from "@/util/fs/directoryExists"
import { runTasks } from "@/util/listr/runTasks";
import { GLOBAL_REGION, MANAGEMENT_ENVIRONMENT, MODULES } from "@/util/terragrunt/constants";
import { getModuleStatus } from "@/util/terragrunt/getModuleStatus";
import { buildDeployModuleTask, defineInputUpdate } from "@/util/terragrunt/tasks/deployModuleTask";
import { terragruntOutput } from "@/util/terragrunt/terragruntOutput";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import { checkAdminPermissions } from "./checkAdminPermissions";
import { getAccountEmail } from "./getAccountEmail";
import { getNewAccountAlias } from "./getNewAccountAlias";
import type { PanfactumContext } from "@/util/context/context"

/**
 * Interface for provisionAWSAccount function inputs
 */
interface IProvisionAWSAccountInputs {
    /** AWS profile name to be created for the environment */
    environmentProfile: string;
    /** Name of the environment being provisioned */
    environmentName: string;
    /** Panfactum context for logging and configuration */
    context: PanfactumContext;
}

/**
 * Interface for provisionAWSAccount function output
 */
interface IProvisionAWSAccountOutput {
    /** The account name for the environment */
    newAccountName: string;
    /** Whether the provisioning was skipped because the account was already created */
    alreadyProvisioned: boolean;
}

export async function provisionAWSAccount(inputs: IProvisionAWSAccountInputs): Promise<IProvisionAWSAccountOutput> {

    const { context, environmentName, environmentProfile } = inputs


    const orgModulePath = join(context.devshellConfig.environments_dir, MANAGEMENT_ENVIRONMENT, GLOBAL_REGION, MODULES.AWS_ORGANIZATION)
    const orgModuleYAMLPath = join(orgModulePath, "module.yaml")
    interface ITaskContext {
        newAccountName?: string;
        newAccountId?: string;
    }
    const tasks = new Listr<ITaskContext>([], {
        ctx: {}
    })

    ////////////////////////////////////////////////////////////////
    // Ensure that AWS Org is installed
    ////////////////////////////////////////////////////////////////
    if (! await directoryExists({ path: orgModulePath })) {
        throw new CLIError("This Panfactum installation does not have an AWS Organization deployed. Cannot automatically provision AWS account.")
    }

    ////////////////////////////////////////////////////////////////
    // Check to see if the account has already been provisioned
    ////////////////////////////////////////////////////////////////
    const accountsFromModule = await listAccountFromOrgModule(context, orgModuleYAMLPath)
    const existingConfig = accountsFromModule.find(account => account.environment === environmentName)
    if (existingConfig) {
        const moduleStatus = await getModuleStatus({
            context,
            environment: MANAGEMENT_ENVIRONMENT,
            region: GLOBAL_REGION,
            module: MODULES.AWS_ORGANIZATION
        })
        if (moduleStatus.deploy_status === "success") {
            const existingProfiles = await getAWSProfiles(context)
            if (existingProfiles.includes(environmentProfile)) {
                const profileStatus = checkAdminPermissions({ context, profile: environmentProfile })
                if ((await profileStatus).status === "success") {
                    context.logger.success(`AWS account for the ${environmentName} environment was already provisioned.`)
                    return { newAccountName: existingConfig.name, alreadyProvisioned: true }
                }
            }
        }
    }

    context.logger.info(
        `Since you are using AWS Organizations, this installer can automate the creation of the AWS account for the ${environmentName} environment.`,
    )

    ////////////////////////////////////////////////////////////////
    // Provision the new AWS account
    ////////////////////////////////////////////////////////////////
    const { aws_profile: managementProfile } = await getPanfactumConfig({ context, directory: orgModulePath })
    if (!managementProfile) {
        throw new CLIError(`Could not find valid AWS profile for the AWS management account`)
    }

    const [orgClient, managementSTSClient] = await Promise.all([
        getOrganizationsClient({ context, profile: managementProfile }),
        getSTSClient({ context, profile: managementProfile })
    ])

    tasks.add({
        title: "Provision new AWS account",
        skip: async () => {
            // If the profile was already created, that means the account
            // already exists
            return (await getAWSProfiles(context)).includes(environmentProfile)
        },
        task: async (parentContext, parentTask) => {

            interface IProvisionAccountCtx {
                newAccountName?: string,
                newAccountEmail?: string,
                existingEmails: string[]
            }

            return parentTask.newListr<IProvisionAccountCtx>([
                {
                    title: "Verify access",
                    task: async () => {
                        await getIdentity({ context, profile: managementProfile })
                    }
                },
                {
                    title: "Get AWS Account configuration",
                    task: async (ctx, task) => {

                        //////////////////////////////////////////////////
                        // If the environment was already added to the AWS Organization module
                        // inputs, then we can skip
                        ///////////////////////////////////////////////////
                        const existingAccountsFromModule = await listAccountFromOrgModule(context, orgModuleYAMLPath)
                        const existingConfig = existingAccountsFromModule.find(account => account.environment === environmentName)
                        if (existingConfig) {
                            ctx.newAccountName = existingConfig.name
                            ctx.newAccountEmail = existingConfig.email
                            return
                        }

                        //////////////////////////////////////////////////
                        // Get the account alias
                        ///////////////////////////////////////////////////

                        const existingAccountsFromAPI = await listAccounts(orgClient)
                        const existingNamesFromModule = existingAccountsFromModule.map(({ name }) => name)
                        const existingNamesFromAPI = existingAccountsFromAPI.map(({ name }) => name)
                        const existingNames = existingNamesFromModule.concat(existingNamesFromAPI)
                        ctx.newAccountName = await getNewAccountAlias({
                            context,
                            task,
                            denylist: existingNames,
                            defaultAlias: `${environmentName}-${Math.random().toString(36).substring(2, 10)}`
                        })
                        parentContext.newAccountName = ctx.newAccountName


                        ///////////////////////////////////////////////////
                        // Get the default account email
                        ///////////////////////////////////////////////////
                        ctx.existingEmails = existingAccountsFromAPI.map(({ email }) => email)
                            .concat(existingAccountsFromModule.map(({ email }) => email))
                        const managementAccountEmail = await getAccountEmail({ context, orgClient })
                        let emailDefault: string | undefined;
                        if (managementAccountEmail) {
                            const [user, domain] = managementAccountEmail.split("@")
                            if (user && domain) {
                                // Defaults to user+envName@domain.com but falls
                                // back to user+accountAlias@domain.com if needed
                                if (user.includes("+")) {
                                    const [prePlus] = user.split("+")
                                    emailDefault = `${prePlus}+${environmentName}@${domain}`
                                    if (ctx.existingEmails.includes(emailDefault)) {
                                        emailDefault = `${prePlus}+${ctx.newAccountName}@${domain}`
                                        if (ctx.existingEmails.includes(emailDefault)) {
                                            emailDefault = undefined
                                        }
                                    }
                                } else {
                                    emailDefault = `${user}+${environmentName}@${domain}`
                                    if (ctx.existingEmails.includes(emailDefault)) {
                                        emailDefault = `${user}+${ctx.newAccountName}@${domain}`
                                        if (ctx.existingEmails.includes(emailDefault)) {
                                            emailDefault = undefined
                                        }
                                    }
                                }
                            }
                        }

                        ///////////////////////////////////////////////////
                        // Get the actual account email
                        ///////////////////////////////////////////////////
                        ctx.newAccountEmail = await context.logger.input({
                            explainer: {
                                message: `AWS also requires a globally unique email for the account. Hint: consider using a '+' suffix like '${emailDefault ?? `you+${environmentName}@yourdomain.com`}'.`,
                                highlights: ["globally"]
                            },
                            task,
                            message: 'Unique Account Email:',
                            required: true,
                            default: emailDefault,
                            validate: (value) => {
                                const { error } = z.string().email().safeParse(value)
                                if (error) {
                                    return error.issues[0]?.message ?? "Invalid email"
                                }
                                const existingEmailIndex = existingAccountsFromAPI.findIndex(({ email }) => email === value)
                                if (existingEmailIndex !== -1) {
                                    return `Every account must have a unique email. That email is already taken by the ${existingAccountsFromAPI[existingEmailIndex]!.name} account.`
                                }
                                if (existingAccountsFromModule.findIndex(({ email }) => email === value) !== -1) {
                                    return `Every account must have a unique email. That email is already taken.`
                                }
                                if (value.length > 64) {
                                    return `Account emails must be 64 characters or less.`
                                }
                                return true
                            }
                        });
                    }
                },

                // Note that we have to create the account via the SDK b/c there is no easy way to check if the email
                // is already being used by another account as this has to be a GLOBALLY unique email. If we proceeded,
                // to deploy the IaC module without this step, the IaC deployment might fail with no ability to retry
                {
                    title: "Create AWS Account",
                    task: async (ctx, task) => {

                        let { newAccountEmail } = ctx;
                        const { newAccountName } = ctx;

                        if (!newAccountEmail) {
                            throw new CLIError("newAccountEmail not set. This should never happen.")
                        }

                        if (!newAccountName) {
                            throw new CLIError("newAccountName not set. This should never happen.")
                        }

                        /////////////////////////////////////////////
                        // Verify the account doesn't already exist
                        /////////////////////////////////////////////
                        const existingAccounts = await listAccounts(orgClient)
                        const existingAccount = existingAccounts.find(account => account.name === newAccountName)
                        if (existingAccount) {
                            parentContext.newAccountId = existingAccount.id
                        }

                        /////////////////////////////////////////////
                        // Try to create the account
                        /////////////////////////////////////////////
                        const alreadyTriedEmails: string[] = []
                        while (!parentContext.newAccountId) {

                            // Try to create the account
                            alreadyTriedEmails.push(newAccountEmail)
                            task.title = context.logger.applyColors("Create AWS Account Pending", { lowlights: ["Pending"] })
                            const response = await orgClient.send(new CreateAccountCommand({
                                Email: newAccountEmail,
                                AccountName: newAccountName,
                                IamUserAccessToBilling: "ALLOW"
                            }))

                            if (response.CreateAccountStatus?.State === "SUCCEEDED") {
                                parentContext.newAccountId = response.CreateAccountStatus.AccountId
                                break;
                            }
                            let failureReason = response.CreateAccountStatus?.FailureReason;

                            // If the creation is in progress wait for it to complete 
                            if (response.CreateAccountStatus?.State === "IN_PROGRESS") {
                                let retryCount = 1;
                                const maxRetries = 30;
                                while (true) {
                                    task.title = context.logger.applyColors(
                                        `Create AWS Account Pending ${retryCount} / ${maxRetries}`,
                                        { lowlights: [`Pending ${retryCount} / ${maxRetries}`] }
                                    )
                                    const statusResponse = await orgClient.send(new DescribeCreateAccountStatusCommand({
                                        CreateAccountRequestId: response.CreateAccountStatus.Id
                                    }))

                                    if (statusResponse.CreateAccountStatus?.State === "FAILED") {
                                        failureReason = statusResponse.CreateAccountStatus?.FailureReason
                                        break;
                                    } else if (statusResponse.CreateAccountStatus?.State === "SUCCEEDED") {
                                        parentContext.newAccountId = statusResponse.CreateAccountStatus.AccountId
                                        break;
                                    } else if (retryCount >= maxRetries) {
                                        throw new CLIError("Timed out waiting for AWS account creation to complete");
                                    }
                                    // Sleep for 5 seconds before checking the status again
                                    await new Promise(resolve => globalThis.setTimeout(resolve, 5000));
                                    retryCount++;
                                }
                            }


                            if (!failureReason) {
                                break;
                            } else if (failureReason === "EMAIL_ALREADY_EXISTS") {
                                task.title = context.logger.applyColors("Create AWS Account Retrying", { lowlights: ["Retrying"] })

                                // Construct a default email
                                let defaultEmail;
                                const [user, domain] = newAccountEmail.split("@")
                                if (user && domain) {
                                    if (user.includes("+")) {
                                        defaultEmail = `${user}-${Math.random().toString(36).substring(2, 4)}@${domain}`
                                    } else {
                                        defaultEmail = `${user}+${environmentName}@${domain}`
                                    }
                                    if (alreadyTriedEmails.includes(defaultEmail) || ctx.existingEmails.includes(defaultEmail)) {
                                        defaultEmail = `${user}-${Math.random().toString(36).substring(2, 4)}@${domain}`
                                    }
                                }

                                newAccountEmail = await context.logger.input({
                                    explainer: {
                                        message: `${newAccountEmail} is already in use. Pick a different email.`,
                                        highlights: [newAccountEmail]
                                    },
                                    task,
                                    default: defaultEmail,
                                    message: 'Unique Account Email:',
                                    required: true,
                                    validate: (value) => {
                                        const { error } = z.string().email().safeParse(value)
                                        if (error) {
                                            return error.issues[0]?.message ?? "Invalid email"
                                        }
                                        if (alreadyTriedEmails.includes(value)) {
                                            return "Already tried this email."
                                        }
                                        if (value.length > 64) {
                                            return `Account emails must be 64 characters or less.`
                                        }
                                        return true
                                    }
                                });

                                ctx.newAccountEmail = newAccountEmail
                            } else {
                                throw new CLIError(`Failed to create new account. Failure reason: ${failureReason}`)
                            }
                        }

                        task.title = context.logger.applyColors(`Created AWS Account ${parentContext.newAccountId}`, { lowlights: [parentContext.newAccountId!] })
                    }
                },
                {
                    title: "Apply AWS Organization settings to account",
                    task: async (ctx, parentTask) => {
                        const { newAccountEmail, newAccountName } = ctx;
                        const { newAccountId } = parentContext;

                        if (newAccountId === undefined) {
                            throw new CLIError('New account id is undefined. This should never happen.')
                        }
                        if (newAccountEmail === undefined) {
                            throw new CLIError('New account email is undefined. This should never happen.')
                        }
                        if (newAccountName === undefined) {
                            throw new CLIError('New account name is undefined. This should never happen.')
                        }
                        return parentTask.newListr([
                            await buildDeployModuleTask<IProvisionAccountCtx>({
                                context,
                                environment: MANAGEMENT_ENVIRONMENT,
                                region: GLOBAL_REGION,
                                module: MODULES.AWS_ORGANIZATION,
                                taskTitle: "Deploy module",
                                imports: {
                                    [`aws_organizations_account.accounts["${newAccountName}"]`]: {
                                        resourceId: `${newAccountId}_ALLOW`
                                    }
                                },
                                inputUpdates: {
                                    accounts: defineInputUpdate({
                                        schema: z.record(z.string(), z.object({ name: z.string(), email: z.string().email(), environment: z.string().optional() })),
                                        update: (oldInput) => {
                                            return {
                                                ...oldInput,
                                                ...{
                                                    [newAccountName]: {
                                                        name: newAccountName,
                                                        email: newAccountEmail,
                                                        environment: environmentName
                                                    }
                                                }
                                            }
                                        }
                                    })
                                }
                            })
                        ])

                    }
                }
            ], { ctx: { existingEmails: [] } })
        }
    })

    ////////////////////////////////////////////////////////////////
    // Setup an IAM user in the new account with admin access
    ////////////////////////////////////////////////////////////////


    interface IBootstrapUserTaskCtx {
        iamClient?: IAMClient;
        accessKeyId?: string
        secretAccessKey?: string;
    }
    const boostrapUserTaskCtx: IBootstrapUserTaskCtx = {}
    const adminUsername = `${environmentName}-superuser`;
    tasks.add({
        title: "Provision bootstrap user for new account",
        skip: async () => {
            if ((await getAWSProfiles(context)).includes(environmentProfile)) {
                return (await checkAdminPermissions({ context, profile: environmentProfile })).status === "success"
            } else {
                return false
            }
        },
        task: async (parentContext, parentTask) => {
            return parentTask.newListr<IBootstrapUserTaskCtx>([
                {
                    title: "Retrieve new AWS account ID",
                    task: async (_, task) => {
                        if (!parentContext.newAccountId) {
                            if (parentContext.newAccountName === undefined) {
                                throw new CLIError('New account name is undefined. This should never happen.')
                            }

                            const { aws_accounts: { value: accounts } } = await terragruntOutput({
                                context,
                                environment: MANAGEMENT_ENVIRONMENT,
                                region: GLOBAL_REGION,
                                module: MODULES.AWS_ORGANIZATION,
                                awsProfile: managementProfile,
                                validationSchema: z.object({
                                    aws_accounts: z.object({
                                        value: z.record(z.string(), z.object({ id: z.string() }))
                                    })
                                })
                            })

                            parentContext.newAccountId = accounts[parentContext.newAccountName]?.id

                            if (!parentContext.newAccountId) {
                                throw new CLIError('Was not able to find account ID for new account')
                            }
                        }
                        task.title = context.logger.applyColors(`Retrieved new AWS account ID ${parentContext.newAccountId}`, { lowlights: [parentContext.newAccountId] })
                    }
                },
                {
                    title: "Login to new account",
                    task: async (ctx) => {

                        const assumeRoleCommand = new AssumeRoleCommand({
                            RoleArn: `arn:aws:iam::${parentContext.newAccountId}:role/OrganizationAccountAccessRole`,
                            RoleSessionName: "ProvisionAdminUser"
                        });

                        const assumeRoleResponse = await managementSTSClient.send(assumeRoleCommand);

                        if (!assumeRoleResponse.Credentials) {
                            throw new CLIError("Failed to assume the OrganizationAccountAccessRole in the new account");
                        }

                        ctx.iamClient = new IAMClient({
                            credentials: {
                                accessKeyId: assumeRoleResponse.Credentials.AccessKeyId || "",
                                secretAccessKey: assumeRoleResponse.Credentials.SecretAccessKey || "",
                                sessionToken: assumeRoleResponse.Credentials.SessionToken
                            },
                            region: "us-east-1"
                        });

                    }
                },
                {
                    title: context.logger.applyColors(`Create new IAM user ${adminUsername}`, { lowlights: [adminUsername] }),
                    task: async (ctx) => {
                        if (!ctx.iamClient) {
                            throw new CLIError('IAMClient does not exist. This should never happen.')
                        }
                        const createUserCommand = new CreateUserCommand({
                            UserName: adminUsername
                        });
                        await ctx.iamClient.send(createUserCommand).catch((e) => {
                            throw new CLIError(`Was not able to create the IAM user ${adminUsername}`, e)
                        })

                    }
                },
                {
                    title: "Attach AdministratorAccess policy",
                    task: async (ctx) => {
                        if (!ctx.iamClient) {
                            throw new CLIError('IAMClient does not exist. This should never happen.')
                        }
                        const attachPolicyCommand = new AttachUserPolicyCommand({
                            UserName: adminUsername,
                            PolicyArn: "arn:aws:iam::aws:policy/AdministratorAccess"
                        });

                        await ctx.iamClient.send(attachPolicyCommand).catch((e) => {
                            throw new CLIError(`Was not able to attach 'AdministratorAccess' policy to the the IAM user ${adminUsername}`, e)
                        })
                    }
                },
                {
                    title: "Create access key",
                    task: async (ctx) => {
                        if (!ctx.iamClient) {
                            throw new CLIError('IAMClient does not exist. This should never happen.')
                        }
                        const createAccessKeyCommand = new CreateAccessKeyCommand({
                            UserName: adminUsername
                        });

                        const accessKeyResponse = await ctx.iamClient.send(createAccessKeyCommand).catch((e) => {
                            throw new CLIError("Failed to create access key for the admin user", e);
                        })

                        if (!accessKeyResponse.AccessKey) {
                            throw new CLIError("Failed to create access key for the admin user");
                        }

                        const {
                            AccessKey: {
                                AccessKeyId: accessKeyId,
                                SecretAccessKey: secretAccessKey
                            }
                        } = accessKeyResponse


                        if (!accessKeyId || !secretAccessKey) {
                            throw new CLIError("Failed to create access key for the admin user");
                        }

                        ctx.accessKeyId = accessKeyId
                        ctx.secretAccessKey = secretAccessKey
                    }
                },
                {
                    title: "Save credentials",
                    task: async (ctx) => {
                        await addAWSProfileFromStaticCreds({
                            context,
                            creds: {
                                accessKeyId: ctx.accessKeyId!,
                                secretAccessKey: ctx.secretAccessKey!
                            },
                            profile: environmentProfile
                        })
                    }
                },

            ], { ctx: boostrapUserTaskCtx })
        }
    })

    let { newAccountName } = await runTasks({ context, tasks, errorMessage: "Failed to provision AWS account" })

    // We may not get the account name back from `runTasks` due to skips, so
    // instead we can retrieve it from the module inputs
    if (!newAccountName) {
        const accountsFromModule = await listAccountFromOrgModule(context, orgModuleYAMLPath)
        const existingConfig = accountsFromModule.find(account => account.environment === environmentName)
        if (existingConfig) {
            newAccountName = existingConfig.name
        } else {
            throw new CLIError("Failed to get account name from account provision task. This should never happen.")
        }
    }

    return { newAccountName, alreadyProvisioned: false };
}


async function listAccounts(orgClient: OrganizationsClient) {
    let existingAccounts: Array<{ name: string, email: string, id: string }> = [];
    let nextToken: string | undefined;
    while (true) {
        const listAccountsCommand = new ListAccountsCommand({ MaxResults: 10, NextToken: nextToken });
        const response = await orgClient.send(listAccountsCommand).catch((e) => {
            throw new CLIError("Failed to list AWS organization accounts", e);
        });
        existingAccounts = existingAccounts.concat((response.Accounts || []).map(account => ({
            name: account.Name || '',
            email: account.Email || '',
            id: account.Id || ''
        })));
        nextToken = response.NextToken
        if (!nextToken) {
            break;
        }
    }
    return existingAccounts
}

async function listAccountFromOrgModule(context: PanfactumContext, orgModuleYAMLPath: string) {
    const originalInputs = await readYAMLFile({
        filePath: orgModuleYAMLPath,
        context,
        validationSchema: z.object({
            extra_inputs: z.object({
                accounts: z.record(z.string(), z.object({
                    name: z.string(),
                    email: z.string().email(),
                    environment: z.string().optional()
                }).passthrough()).optional().default({})
            }).passthrough().optional().default({})
        }).passthrough()
    })
    return Object.values(originalInputs?.extra_inputs.accounts ?? {})
}