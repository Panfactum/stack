import { join } from "node:path"
import { CreateUserCommand, AttachUserPolicyCommand, CreateAccessKeyCommand, IAMClient } from "@aws-sdk/client-iam";
import { ListAccountsCommand, OrganizationsClient } from "@aws-sdk/client-organizations";
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import { Listr } from "listr2";
import { z } from "zod";
import { getPanfactumConfig } from "@/commands/config/get/getPanfactumConfig";
import { addAWSProfileFromStaticCreds } from "@/util/aws/addAWSProfileFromStaticCreds";
import { getCredsFromFile } from "@/util/aws/getCredsFromFile";
import { getIdentity } from "@/util/aws/getIdentity";
import { CLIError } from "@/util/error/error";
import { directoryExists } from "@/util/fs/directoryExist"
import { runTasks } from "@/util/listr/runTasks";
import { GLOBAL_REGION, MANAGEMENT_ENVIRONMENT, MODULES } from "@/util/terragrunt/constants";
import { buildDeployModuleTask, defineInputUpdate } from "@/util/terragrunt/tasks/deployModuleTask";
import { terragruntOutput } from "@/util/terragrunt/terragruntOutput";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import { getAccountEmail } from "./getAccountEmail";
import { getNewAccountAlias } from "./getNewAccountAlias";
import type { PanfactumContext } from "@/util/context/context"

export const AWS_ORG_MODULE = "aws_organization"


export async function provisionAWSAccount(inputs: {
    environmentProfile: string;
    environmentName: string;
    context: PanfactumContext
}) {

    const { context, environmentName, environmentProfile } = inputs

    context.logger.info(
        `Since you are using AWS Organizations, this installer can automate the creation of the AWS account for the ${environmentName} environment.`,
    )

    const orgModulePath = join(context.repoVariables.environments_dir, MANAGEMENT_ENVIRONMENT, "global", AWS_ORG_MODULE)
    const orgModuleYAMLPath = join(orgModulePath, "module.yaml")
    interface TaskContext {
        newAccountName?: string;
    }

    const tasks = new Listr<TaskContext>([], {
        ctx: {}
    })

    ////////////////////////////////////////////////////////////////
    // Ensure that AWS Org is installed
    ////////////////////////////////////////////////////////////////
    if (! await directoryExists(orgModulePath)) {
        throw new CLIError("This Panfactum installation does not have an AWS Organization deployed. Cannot automatically provision AWS account.")
    }

    ////////////////////////////////////////////////////////////////
    // Provision the new AWS account
    ////////////////////////////////////////////////////////////////
    const { aws_profile: managementProfile } = await getPanfactumConfig({ context, directory: orgModulePath })
    if (!managementProfile) {
        throw new CLIError(`Could not find valid AWS profile for the AWS management account`)
    }

    // We have to do this to workaround a bug in the AWS node SDK where credentials
    // are not automatically loaded from disk if they were created during this
    // process's execution
    const credentials = await getCredsFromFile({ context, profile: managementProfile })
    let orgClient;
    if (credentials) {
        orgClient = new OrganizationsClient({
            credentials,
            region: "us-east-1"
        });
    } else {
        orgClient = new OrganizationsClient({
            profile: managementProfile,
            region: "us-east-1"
        });
    }

    let managementSTSClient;
    if (credentials) {
        managementSTSClient = new STSClient({
            credentials,
            region: "us-east-1"
        });
    } else {
        managementSTSClient = new STSClient({
            profile: managementProfile,
            region: "us-east-1"
        });
    }

    tasks.add({
        title: "Provision new AWS account",
        task: async (parentContext, parentTask) => {

            interface ProvisionAccountCtx {
                newAccountName?: string,
                newAccountEmail?: string
            }

            return parentTask.newListr<ProvisionAccountCtx>([
                {
                    title: "Verify access",
                    task: async () => {
                        await getIdentity({ context, profile: managementProfile })
                    }
                },
                {
                    title: "Get AWS Account configuration",
                    task: async (ctx, task) => {
                        const originalInputs = await readYAMLFile({
                            filePath: orgModuleYAMLPath,
                            context,
                            validationSchema: z.object({
                                extra_inputs: z.object({
                                    accounts: z.record(z.string(), z.object({
                                        name: z.string(),
                                        email: z.string().email()
                                    }).passthrough()).optional().default({})
                                }).passthrough().optional().default({})
                            }).passthrough()
                        })


                        //////////////////////////////////////////////////
                        // Get the account alias
                        ///////////////////////////////////////////////////

                        let existingAccounts: Array<{ name: string, email: string, id: string }> = [];
                        try {
                            const listAccountsCommand = new ListAccountsCommand({});
                            const response = await orgClient.send(listAccountsCommand);
                            existingAccounts = (response.Accounts || []).map(account => ({
                                name: account.Name || '',
                                email: account.Email || '',
                                id: account.Id || ''
                            }));
                        } catch (e) {
                            throw new CLIError("Failed to list AWS organization accounts", e);
                        }

                        const accountKeys = Object.keys(originalInputs?.extra_inputs.accounts ?? {})
                        const existingNames = existingAccounts.map(({ name }) => name)
                        ctx.newAccountName = await getNewAccountAlias({
                            context,
                            task,
                            denylist: accountKeys.concat(existingNames)
                        })
                        parentContext.newAccountName = ctx.newAccountName


                        ///////////////////////////////////////////////////
                        // Get the default account email
                        ///////////////////////////////////////////////////
                        const existingEmails = existingAccounts.map(({ email }) => email)
                            .concat((Object.values(originalInputs?.extra_inputs.accounts ?? {}).map(({ email }) => email)))
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
                                    if (existingEmails.includes(emailDefault)) {
                                        emailDefault = `${prePlus}+${ctx.newAccountName}@${domain}`
                                        if (existingEmails.includes(emailDefault)) {
                                            emailDefault = undefined
                                        }
                                    }
                                } else {
                                    emailDefault = `${user}+${environmentName}@${domain}`
                                    if (existingEmails.includes(emailDefault)) {
                                        emailDefault = `${user}+${ctx.newAccountName}@${domain}`
                                        if (existingEmails.includes(emailDefault)) {
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
                                const existingEmailIndex = existingAccounts.findIndex(({ email }) => email === value)
                                if (existingEmailIndex !== -1) {
                                    return `Every account must have a unique email. That email is already taken by the ${existingAccounts[existingEmailIndex]!.name} account.`
                                }
                                if (Object.values(originalInputs?.extra_inputs.accounts ?? {}).findIndex(({ email }) => email === value) !== -1) {
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

                // TODO: We need a better way to retry if this fails due to a duplicate email error;
                // AFAIK there is no way to tell if the email is already in use without running this apply
                await buildDeployModuleTask<ProvisionAccountCtx>({
                    context,
                    environment: MANAGEMENT_ENVIRONMENT,
                    region: GLOBAL_REGION,
                    module: MODULES.AWS_ORGANIZATION,
                    taskTitle: "Use AWS Organization to create account",
                    inputUpdates: {
                        accounts: defineInputUpdate({
                            schema: z.record(z.string(), z.object({ name: z.string(), email: z.string() })),
                            update: (oldInput, ctx) => {
                                if (ctx.newAccountEmail === undefined) {
                                    throw new CLIError('New account email is undefined. This should never happen.')
                                }

                                if (ctx.newAccountName === undefined) {
                                    throw new CLIError('New account name is undefined. This should never happen.')
                                }
                                return {
                                    ...oldInput,
                                    ...{
                                        [ctx.newAccountName]: {
                                            name: ctx.newAccountName,
                                            email: ctx.newAccountEmail
                                        }
                                    }
                                }
                            }
                        })
                    }
                })

            ], { ctx: {} })
        }
    })

    ////////////////////////////////////////////////////////////////
    // Setup an IAM user in the new account with admin access
    ////////////////////////////////////////////////////////////////

    const adminUsername = `${environmentName}-superuser`;
    interface BootstrapUserTaskCtx {
        newAccountId?: string;
        iamClient?: IAMClient;
        accessKeyId?: string
        secretAccessKey?: string;
    }
    const boostrapUserTaskCtx: BootstrapUserTaskCtx = {}
    tasks.add({
        title: "Provision bootstrap user for new account",
        task: async (parentContext, parentTask) => {
            return parentTask.newListr<BootstrapUserTaskCtx>([
                {
                    title: "Retrieve new AWS account ID",
                    task: async (ctx, task) => {

                        if (parentContext.newAccountName === undefined) {
                            throw new CLIError('New account name is undefined. This should never happen.')
                        }

                        const { aws_accounts: { value: accounts } } = await terragruntOutput({
                            context,
                            environment: MANAGEMENT_ENVIRONMENT,
                            region: GLOBAL_REGION,
                            module: AWS_ORG_MODULE,
                            awsProfile: managementProfile,
                            validationSchema: z.object({
                                aws_accounts: z.object({
                                    value: z.record(z.string(), z.object({ id: z.string() }))
                                })
                            })
                        })

                        ctx.newAccountId = accounts[parentContext.newAccountName]?.id

                        if (!ctx.newAccountId) {
                            throw new CLIError('Was not able to find account ID for new account')
                        }

                        task.title = context.logger.applyColors(`Retrieved new AWS account ID ${ctx.newAccountId}`, { lowlights: [ctx.newAccountId] })
                    }
                },
                {
                    title: "Login to new account",
                    task: async (ctx) => {

                        const assumeRoleCommand = new AssumeRoleCommand({
                            RoleArn: `arn:aws:iam::${ctx.newAccountId}:role/OrganizationAccountAccessRole`,
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
                        try {
                            await ctx.iamClient.send(createUserCommand);
                        } catch (e) {
                            throw new CLIError(`Was not able to create the IAM user ${adminUsername}`, e)
                        }

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

                        try {
                            await ctx.iamClient.send(attachPolicyCommand);
                        } catch (e) {
                            throw new CLIError(`Was not able to attach 'AdministratorAccess' policy to the the IAM user ${adminUsername}`, e)
                        }
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

                        let accessKeyResponse;
                        try {
                            accessKeyResponse = await ctx.iamClient.send(createAccessKeyCommand);
                        } catch (e) {
                            throw new CLIError("Failed to create access key for the admin user", e);
                        }

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

    const { newAccountName } = await runTasks({ context, tasks, errorMessage: "Failed to provision AWS account" })

    if (!newAccountName) {
        throw new CLIError("Failed to get account name from account provision task. This should never happen.")
    }

    return newAccountName;
}