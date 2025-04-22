import { join } from "node:path"
import { DeleteAccessKeyCommand, IAMClient } from "@aws-sdk/client-iam";
import { checkbox } from "@inquirer/prompts";
import { ListrInquirerPromptAdapter } from "@listr2/prompt-adapter-inquirer";
import { Listr } from 'listr2'
import pc from "picocolors";
import { z } from "zod";
import { getCredsFromFile } from "@/util/aws/getCredsFromFile";
import { getIdentity } from "@/util/aws/getIdentity";
import { applyColors } from "@/util/colors/applyColors";
import { buildSyncAWSIdentityCenterTask } from "@/util/devshell/tasks/syncAWSIdentityCenterTask";
import { CLIError } from "@/util/error/error";
import { directoryExists } from "@/util/fs/directoryExist";
import { fileContains } from "@/util/fs/fileContains";
import { GLOBAL_REGION, MANAGEMENT_ENVIRONMENT, MODULES } from "@/util/terragrunt/constants";
import { buildDeployModuleTask, defineInputUpdate } from "@/util/terragrunt/tasks/deployModuleTask";
import type { PanfactumContext } from "@/context/context";


interface TaskContext {
    accountId?: string;
    superuserGroups: string[];
    adminGroups: string[];
    readerGroups: string[];
    restrictedReaderGroups: string[];
    billingAdminGroups: string[];
}

export async function updateIAMIdentityCenter(inputs: {
    context: PanfactumContext,
    environmentProfile: string,
    environmentName: string
}) {

    const { context, environmentProfile, environmentName } = inputs;

    const modulePath = join(
        context.repoVariables.environments_dir,
        MANAGEMENT_ENVIRONMENT,
        GLOBAL_REGION,
        MODULES.IAM_IDENTIY_CENTER_PERMISSIONS
    )
    const moduleHCLPath = join(modulePath, "terragrunt.hcl")


    /////////////////////////////////////////////////////////////////////
    // Do some validation
    /////////////////////////////////////////////////////////////////////

    if (!await directoryExists(modulePath)) {
        context.logger.log("Skipping IAM Identity center update as it is not deployed", { level: "debug" })
    }

    if (await fileContains({ context, filePath: moduleHCLPath, regex: /account_access_configuration\s*=/ })) {
        context.logger.log(
            "You have IAM Identity Center deployed, but you are configuring it via `terragrunt.hcl` input rather than using `module.yaml`.\n" +
            "As a result, this installer cannot automatically update the settings."
            ,
            { style: "warning" }
        )
        return
    }

    context.logger.log(
        "🛈  Setting up SSO for the new AWS account",
        {trailingNewlines: 1, leadingNewlines: 1}
    )


    /////////////////////////////////////////////////////////////////////
    // Save the Access Key, so we can deprovision it (if necessary)
    /////////////////////////////////////////////////////////////////////
    const creds = await getCredsFromFile({context, profile: environmentProfile})

    /////////////////////////////////////////////////////////////////////
    // Run the tasks
    /////////////////////////////////////////////////////////////////////

    const tasks = new Listr<TaskContext>([
        {
            title: applyColors(
                `Retrieve AWS account ID for ${environmentName} environment`,
                { highlights: [{ phrase: environmentName, style: "important" }] }
            ),
            task: async (ctx, task) => {
                task.title = applyColors(
                    `Retrieving AWS account ID for ${environmentName} environment`,
                    { highlights: [{ phrase: environmentName, style: "important" }] }
                )
                try {
                    const identity = await getIdentity({ context, profile: environmentProfile })
                    ctx.accountId = identity.Account
                } catch (e) {
                    throw new CLIError(`Was not able to get identity for environment's profile '${environmentProfile}'`, e)
                }
                if (!ctx.accountId) {
                    throw new CLIError(`Was not able to get identity for environment's profile '${environmentProfile}'`)
                }
                task.title = applyColors(
                    `Retrieved AWS account ID for ${environmentName} environment ${ctx.accountId}`,
                    {
                        highlights: [
                            { phrase: environmentName, style: "important" },
                            { phrase: ctx.accountId, style: "subtle" }
                        ]
                    }
                )
            }
        },
        {
            title: "Determine RBAC for Authentik groups",
            task: async (ctx, task) => {
                // TODO: It would be nice if in the future this was able to take into account any customizations
                // that the users had made to the RBAC for their Panfactum installation
                const authentikGroups = [
                    "superusers",
                    "privileged_engineers",
                    "engineers",
                    "restricted_engineers"
                ]

                const generateQuestionText = (permissions: string) => {
                    return applyColors(`Select Authentik groups which will have ${permissions} access to the ${environmentName} environment`, {
                        style: "question",
                        highlights: [environmentName, permissions]
                    })
                }

                const possibleSuperuserGroups = authentikGroups
                ctx.superuserGroups = await task.prompt(ListrInquirerPromptAdapter).run(checkbox, {
                    message: generateQuestionText("superuser"),
                    choices: possibleSuperuserGroups.map(group => ({ name: group, value: group, checked: group === "superusers" })),
                    instructions: false,
                    validate: (choices) => {
                        if (choices.findIndex(el => el.value === "superusers" && el.checked) === -1) {
                            return pc.red(`The ${pc.white("superusers")} group must always have superuser access to all environments`)
                        } else {
                            return true
                        }
                    }
                }) as string[]
                const possibleAdminGroups = possibleSuperuserGroups.filter(group => !ctx.superuserGroups.includes(group))
                if (possibleAdminGroups.length > 0) {
                    ctx.adminGroups = await task.prompt(ListrInquirerPromptAdapter).run(checkbox, {
                        message: generateQuestionText("admin (read / write)"),
                        choices: possibleAdminGroups,
                        instructions: false
                    }) as string[]

                    const possibleReaderGroups = possibleAdminGroups.filter(group => !ctx.adminGroups.includes(group))
                    if (possibleReaderGroups.length > 0) {
                        ctx.readerGroups = await task.prompt(ListrInquirerPromptAdapter).run(checkbox, {
                            message: generateQuestionText("read-only (including secrets)"),
                            choices: possibleReaderGroups,
                            instructions: false
                        }) as string[]
                        const possibleRestrictedReaderGroups = possibleReaderGroups.filter(group => !ctx.readerGroups.includes(group))
                        if (possibleRestrictedReaderGroups.length > 0) {
                            ctx.restrictedReaderGroups = await task.prompt(ListrInquirerPromptAdapter).run(checkbox, {
                                message: generateQuestionText("read-only (NOT including secrets)"),
                                choices: possibleRestrictedReaderGroups,
                                instructions: false
                            }) as string[]
                        }
                    }
                }
            }
        },
        await buildDeployModuleTask<TaskContext>({
            context,
            environment: MANAGEMENT_ENVIRONMENT,
            region: GLOBAL_REGION,
            module: MODULES.IAM_IDENTIY_CENTER_PERMISSIONS,
            taskTitle: "Update AWS IAM Identity Center",
            inputUpdates: {
                account_access_configuration: defineInputUpdate({
                    schema: z.record(z.string(), z.object({
                        account_id: z.string(),
                        superuser_groups: z.array(z.string()).default([]),
                        admin_groups: z.array(z.string()).default([]),
                        reader_groups: z.array(z.string()).default([]),
                        restricted_reader_groups: z.array(z.string()).default([]),
                        billing_admin_groups: z.array(z.string()).default([])
                    }).passthrough()).optional().default({}),
                    update: (oldVal, ctx) => {
                        if(!ctx.accountId){
                            throw new CLIError(`AWS Account ID missing on task context. This should never happen.`)
                        }
                        return {
                            ...oldVal,
                            ...{
                                [environmentName]: {
                                    account_id: ctx.accountId,
                                    superuser_groups: ctx.superuserGroups,
                                    admin_groups: ctx.adminGroups,
                                    reader_groups: ctx.readerGroups,
                                    restricted_reader_groups: ctx.restrictedReaderGroups,
                                    billing_admin_groups: ctx.billingAdminGroups
                                }
                            }
                        }
                    }
                })
            }
        }),
        await buildSyncAWSIdentityCenterTask({context}),
        {
            title: applyColors(`Revoke static IAM credentials ${creds?.accessKeyId}`, {highlights: [{phrase: creds!.accessKeyId, style: "subtle"}]}),
            enabled: () => Boolean(creds?.accessKeyId),
            task: async () => {
                try {
                    const iamClient = new IAMClient({
                        region: "us-east-1",
                        credentials: creds
                    })
  
                    // Delete the access key
                    await iamClient.send(new DeleteAccessKeyCommand({
                        AccessKeyId: creds!.accessKeyId
                    }))
                    
                } catch (error) {
                    throw new CLIError(`Failed to revoke IAM access key ${creds!.accessKeyId}`, error)
                }
            }
        }
    ], {
        ctx: {
            superuserGroups: [],
            adminGroups: [],
            readerGroups: [],
            restrictedReaderGroups: [],
            billingAdminGroups: ["billing_admins"]
        },
        rendererOptions: {
            collapseSubtasks: true
        }
    })

    await tasks.run()
}
