import { join } from "node:path"
import { input } from "@inquirer/prompts";
import { ListrInquirerPromptAdapter } from "@listr2/prompt-adapter-inquirer";
import { stringify, parse } from "ini";
import { DefaultRenderer, ListrTaskWrapper, SimpleRenderer, type ListrTask } from "listr2";
import pc from "picocolors";
import { z } from "zod";
import { getPanfactumConfig } from "@/commands/config/get/getPanfactumConfig";
import { CLIError } from "../../error/error";
import { fileExists } from "../../fs/fileExists";
import { writeFile } from "../../fs/writeFile";
import { GLOBAL_REGION, MANAGEMENT_ENVIRONMENT, MODULES } from "../../terragrunt/constants";
import { terragruntOutput } from "../../terragrunt/terragruntOutput";
import type { PanfactumContext } from "@/context/context";

const IAM_IDENTIY_CENTER_OUTPUT_SCHEMA = z.object({
    cli_config: z.object({
        value: z.array(
            z.object({
                account_name: z.string(),
                account_id: z.string(),
                roles: z.array(z.string()),
            })
        ),
    })
})

interface TaskContext {
    identiyCenterConfig?: z.infer<typeof IAM_IDENTIY_CENTER_OUTPUT_SCHEMA>
    profiles: { [profile: string]: { accountId: string; roleName: string; } }
}

export async function buildSyncAWSIdentityCenterTask<T extends {}>(inputs: {
    context: PanfactumContext
}): Promise<ListrTask<T>> {
    const { context } = inputs;


    const modulePath = join(
        context.repoVariables.environments_dir,
        MANAGEMENT_ENVIRONMENT,
        GLOBAL_REGION,
        MODULES.IAM_IDENTIY_CENTER_PERMISSIONS
    )

    const { aws_region: ssoRegion } = await getPanfactumConfig({ context, directory: modulePath })

    if (!ssoRegion) {
        throw new CLIError(`Cannot update AWS SSO config with the aws_region set in for the ${MODULES.IAM_IDENTIY_CENTER_PERMISSIONS} module`)
    }

    return {
        title: "Sync AWS Identity Center updates to DevShell",
        task: async (_, parentTask) => {
            const subtasks = parentTask.newListr<TaskContext>([], {
                ctx: {
                    profiles: {}
                }
            })

            subtasks.add({
                title: context.logger.applyColors(
                    `Getting outputs from AWS Identity Center Module ${MODULES.IAM_IDENTIY_CENTER_PERMISSIONS}`,
                    { lowlights: [MODULES.IAM_IDENTIY_CENTER_PERMISSIONS] }
                ),
                task: async (ctx, task) => {
                    ctx.identiyCenterConfig = await terragruntOutput({
                        context,
                        environment: MANAGEMENT_ENVIRONMENT,
                        region: GLOBAL_REGION,
                        module: MODULES.IAM_IDENTIY_CENTER_PERMISSIONS,
                        validationSchema: IAM_IDENTIY_CENTER_OUTPUT_SCHEMA
                    });
                    task.title = "Got outputs from AWS Identity Center module"
                }
            })


            subtasks.add({
                title: "Updating .aws/config",
                enabled: (ctx) => ctx.identiyCenterConfig !== undefined,
                task: async (ctx, task) => {
                    const { identiyCenterConfig } = ctx;

                    if (!identiyCenterConfig) {
                        throw new CLIError('Tried to update AWS config without identity center module outputs')
                    }

                    for (const { account_id: id, account_name: name, roles } of identiyCenterConfig.cli_config.value) {
                        for (const role of roles) {
                            const profile = `${name}-${role.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')}`;
                            ctx.profiles[profile] = {
                                accountId: id,
                                roleName: role
                            }
                        }
                    }

                    const configUpdate = Object.fromEntries(Object.entries(ctx.profiles).map(([profile, { accountId, roleName }]) => {
                        return [`profile ${profile}`, {
                            sso_session: "sso",
                            sso_account_id: accountId,
                            sso_role_name: roleName,
                            output: "text",
                            region: ssoRegion
                        }]
                    }))


                    const configFilePath = join(context.repoVariables.aws_dir, "config")


                    let config;
                    if (await fileExists(configFilePath)) {
                        try {
                            const awsConfigFile = Bun.file(configFilePath);
                            const originalAWSConfig = parse(await awsConfigFile.text());
                            config = {
                                ...originalAWSConfig,
                                ...configUpdate
                            }
                            if (!originalAWSConfig["sso-session sso"]) {
                                config["sso-session sso"] = await getSSOConfig(ssoRegion, task)
                            }
                        } catch (e) {
                            throw new CLIError(`Failed to read existing AWS config at ${configFilePath}`, e)
                        }
                    } else {
                        config = {
                            ...configUpdate,
                            ["sso-session sso"]: await getSSOConfig(ssoRegion, task)
                        }
                    }

                    try {
                        await writeFile({ context, path: configFilePath, contents: stringify(config, { newline: false, whitespace: true }), overwrite: true })
                    } catch (e) {
                        throw new CLIError(`Failed to write new AWS config file at ${configFilePath}`, e)
                    }

                    task.title = "Updated .aws/config file"
                }
            })

            subtasks.add({
                title: "Removing old static crdentials",
                enabled: (ctx) => ctx.identiyCenterConfig !== undefined,
                task: async (ctx, task) => {
                    const credentialsFilePath = join(context.repoVariables.aws_dir, "credentials")
                    if (await fileExists(credentialsFilePath)) {
                        let credentials;
                        try {
                            const awsCredentialsFile = Bun.file(credentialsFilePath);
                            const originalCredentials = parse(await awsCredentialsFile.text());
                            credentials = Object.fromEntries(Object.entries(originalCredentials).filter(([origProfile]) => {
                                return ctx.profiles[origProfile] === undefined // Only keep profiles that do not have an sso config
                            }))
                        } catch (e) {
                            throw new CLIError(`Failed to read existing AWS credentials at ${credentialsFilePath}`, e)
                        }
                        try {
                            await writeFile({ context, path: credentialsFilePath, contents: stringify(credentials, { newline: false, whitespace: true }), overwrite: true })
                        } catch (e) {
                            throw new CLIError(`Failed to write new AWS credentials file at ${credentialsFilePath}`, e)
                        }
                    }
                    task.title = "Static credentials removed"
                }
            })

            return subtasks;
        }
    }
}

async function getSSOConfig(ssoRegion: string, task: ListrTaskWrapper<TaskContext, typeof DefaultRenderer, typeof SimpleRenderer>) {
    task.stdout().write("It looks like this is your first time setting up AWS SSO.\n" +
        "We need to collect your AWS Access Portal URL.\n" +
        "You can set/find it by following these instructions: https://docs.aws.amazon.com/singlesignon/latest/userguide/howtochangeURL.html\n" +
        `It should be of the format: ${pc.blue("https://your-subdomain.awsapps.com/start")}`)

    const startURL = await task.prompt(ListrInquirerPromptAdapter).run(input, {
        message: pc.magenta('Access Portal URL:'),
        required: true,
        validate: async (value) => {
            const { error } = z.string()
                .regex(
                    /^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.awsapps\.com\/start$/,
                    pc.red("Must be in format 'https://your-subdomain.awsapps.com/start' where 'your-subdomain' contains only lowercase letters, numbers, and hyphens")
                )
                .safeParse(value)
            if (error) {
                return error.issues[0]?.message ?? "Invalid portal domain"
            }

            try {
                const response = await globalThis.fetch(value)
                if (response.status !== 302 && response.status !== 200) {
                    return pc.red(`The access portal URL doesn't appear active. If you just set it, wait a few minutes for DNS updates to propagate. Otherwise, check for typos.`)
                }
            } catch {
                return pc.red(`The access portal URL doesn't appear active. If you just set it, wait a few minutes for DNS updates to propagate. Otherwise, check for typos.`)
            }

            return true;
        }
    });

    return {
        sso_start_url: startURL,
        sso_region: ssoRegion,
        sso_registration_scopes: "sso:account:access"
    }
}