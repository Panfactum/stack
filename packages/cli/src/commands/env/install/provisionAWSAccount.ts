import { join } from "node:path"
import { CreateUserCommand, AttachUserPolicyCommand, CreateAccessKeyCommand, IAMClient } from "@aws-sdk/client-iam";
import { ListAccountsCommand, OrganizationsClient } from "@aws-sdk/client-organizations";
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import { input } from '@inquirer/prompts';
import { ListrInquirerPromptAdapter } from "@listr2/prompt-adapter-inquirer";
import { Listr } from "listr2";
import pc from "picocolors"
import { z } from "zod";
import { getPanfactumConfig } from "@/commands/config/get/getPanfactumConfig";
import orgHCL from "@/templates/aws_organization.hcl" with { type: "file" };
import { addAWSProfileFromStaticCreds } from "@/util/aws/addAWSProfileFromStaticCreds";
import { getIdentity } from "@/util/aws/getIdentity";
import { applyColors } from "@/util/colors/applyColors";
import { CLIError } from "@/util/error/error";
import { directoryExists } from "@/util/fs/directoryExist"
import { GLOBAL_REGION, MANAGEMENT_ENVIRONMENT, MODULES } from "@/util/terragrunt/constants";
import { buildDeployModuleTask, defineInputUpdate } from "@/util/terragrunt/tasks/deployModuleTask";
import { terragruntOutput } from "@/util/terragrunt/terragruntOutput";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import { AWS_ACCOUNT_ALIAS_SCHEMA } from "./common";
import { getPrimaryContactInfo } from "./getPrimaryContactInfo";
import type { PanfactumContext } from "@/context/context"

export const AWS_ORG_MODULE = "aws_organization"


export async function provisionAWSAccount(inputs: {
    environmentProfile: string;
    environmentName: string;
    context: PanfactumContext
}) {

    const { context, environmentName, environmentProfile } = inputs

    context.logger.log(
        `🛈  Since you are using AWS Organizations, this installer can automate the creation of the AWS account for the ${pc.blue(environmentName)} environment.`,
        { trailingNewlines: 1, leadingNewlines: 1 }
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
    // If necessary, deploy the aws_organization module
    ////////////////////////////////////////////////////////////////
    if (! await directoryExists(orgModulePath)) {
        interface OrgCreateTaskContext {
            primaryContactInfo?: Awaited<ReturnType<typeof getPrimaryContactInfo>>
        }
        tasks.add({
            title: "Configure AWS Organization",
            task: async (_, parentTask) => {
                return parentTask.newListr<OrgCreateTaskContext>([
                    {
                        title: "Collect AWS contact information",
                        task: async (ctx, task) => {
                            task.output = `It looks like this is the first environment for your organization, so we will need to complete a couple\n` +
                                `steps to prepare your organization for deploying environments.\n\n` +
                                `Firstly, AWS requires contact information to ensure you receive important infrastructure notifications.\n` +
                                `This will be automatically synced across all your environments.\n\n`
                            ctx.primaryContactInfo = await getPrimaryContactInfo({ context, parentTask: task })
                        }
                    },
                    // TODO: Ensure that the original organizaiton features are preserved
                    await buildDeployModuleTask<OrgCreateTaskContext>({
                        context,
                        environment: MANAGEMENT_ENVIRONMENT,
                        region: GLOBAL_REGION,
                        module: MODULES.AWS_ORGANIZATION,
                        taskTitle: "Deploy AWS Organization updates",
                        hclIfMissing: await Bun.file(orgHCL).text(),
                        inputUpdates: {
                            account_access_configuration: defineInputUpdate({
                                schema: z.record(z.string(), z.string().optional()).optional().default({}),
                                update: (oldInput, ctx) => {
                                    if (!ctx.primaryContactInfo) {
                                        throw new CLIError("Primary contact info missing. This should never happen.")
                                    }
                                    return { ...oldInput, ...ctx.primaryContactInfo }
                                }
                            })
                        }
                    })
                ], { ctx: {} })
            }
        })
    }

    ////////////////////////////////////////////////////////////////
    // Provision the new AWS account
    ////////////////////////////////////////////////////////////////
    const { aws_profile: managementProfile } = await getPanfactumConfig({ context, directory: orgModulePath })
    if (!managementProfile) {
        throw new CLIError(`Could not find valid AWS profile for the AWS management account`)
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


                        const orgClient = new OrganizationsClient({
                            profile: managementProfile
                        });
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

                        task.output = applyColors("Even though your environment name only needs to be unique to your organization, AWS requires a globally unique name for the underlying AWS account.", {
                            style: "warning",
                            highlights: ["globally"]
                        })

                        const accountKeys = Object.keys(originalInputs?.extra_inputs.accounts ?? {})
                        const existingNames = existingAccounts.map(({ name }) => name)
                        ctx.newAccountName = await task.prompt(ListrInquirerPromptAdapter).run(input, {
                            message: pc.magenta('Unique Account Name:'),
                            required: true,
                            default: existingNames.includes(environmentName) ? undefined : environmentName,
                            validate: async (value) => {
                                const { error } = AWS_ACCOUNT_ALIAS_SCHEMA.safeParse(value)
                                if (error) {
                                    return applyColors(error.issues[0]?.message ?? "Invalid account name", {style: "error"})
                                }
                                const existingNameIndex = existingAccounts.findIndex(({ name }) => name === value)
                                if (existingNameIndex !== -1) {
                                    return applyColors(`Every account must have a unique name. Name is already taken by another account in your organization (${existingAccounts[existingNameIndex]!.id}).`, {style: "error"})
                                }
                                if (accountKeys.includes(value)) {
                                    return applyColors(`Every account must have a unique name. Name is already taken.`, {style: "error"})
                                }
                                const response = await globalThis.fetch(`https://${value}.signin.aws.amazon.com`)
                                if (response.status !== 404) {
                                    return applyColors(`Every account must have a globally unique name. Name is already take by another organization.`, {style: "error"})
                                }
                                return true
                            }
                        });
                        parentContext.newAccountName = ctx.newAccountName


                        task.output = applyColors(`AWS also requires a globally unique email for the account. Hint: consider using a '+' suffix like 'you+${environmentName}@yourdomain.com'.`, {
                            style: "warning",
                            highlights: ["globally"]
                        })

                        // TODO: We should endeavor to provide a sane default here
                        ctx.newAccountEmail = await task.prompt(ListrInquirerPromptAdapter).run(input, {
                            message: pc.magenta('Unique Account Email:'),
                            required: true,
                            validate: (value) => {
                                const { error } = z.string().email().safeParse(value)
                                if (error) {
                                    return applyColors(error.issues[0]?.message ?? "Invalid email", {style: "error"})
                                }
                                const existingEmailIndex = existingAccounts.findIndex(({ email }) => email === value)
                                if (existingEmailIndex !== -1) {
                                    return applyColors(`Every account must have a unique email. That email is already taken by the ${existingAccounts[existingEmailIndex]!.name} account.`, {style: "error"})
                                }
                                if (Object.values(originalInputs?.extra_inputs.accounts ?? {}).findIndex(({ email }) => email === value) !== -1) {
                                    return applyColors(`Every account must have a unique email. That email is already taken.`, {style: "error"})
                                }
                                if (value.length > 64) {
                                    return applyColors(`Account emails must be 64 characters or less.`, {style: "error"})
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

                        task.title = applyColors(`Retrieved new AWS account ID ${ctx.newAccountId}`, { highlights: [{ phrase: ctx.newAccountId, style: "subtle" }] })
                    }
                },
                {
                    title: "Login to new account",
                    task: async (ctx) => {

                        const stsClient = new STSClient({
                            profile: managementProfile
                        });

                        const assumeRoleCommand = new AssumeRoleCommand({
                            RoleArn: `arn:aws:iam::${ctx.newAccountId}:role/OrganizationAccountAccessRole`,
                            RoleSessionName: "ProvisionAdminUser"
                        });

                        const assumeRoleResponse = await stsClient.send(assumeRoleCommand);

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
                    title: applyColors(`Create new IAM user ${adminUsername}`, { highlights: [{ phrase: adminUsername, style: "subtle" }] }),
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

    try {
        await tasks.run()
    } catch (e) {
        throw new CLIError("Failed to provision AWS account", e)
    }

}