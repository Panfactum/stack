import { join } from "node:path"
import { DeleteAccessKeyCommand, IAMClient } from "@aws-sdk/client-iam";
import { Listr } from 'listr2'
import { z } from "zod";
import { getCredsFromFile } from "@/util/aws/getCredsFromFile";
import { getIdentity } from "@/util/aws/getIdentity";
import { buildSyncAWSIdentityCenterTask } from "@/util/devshell/tasks/syncAWSIdentityCenterTask";
import { CLIError } from "@/util/error/error";
import { fileContains } from "@/util/fs/fileContains";
import { GLOBAL_REGION, MANAGEMENT_ENVIRONMENT, MODULES } from "@/util/terragrunt/constants";
import { getModuleStatus } from "@/util/terragrunt/getModuleStatus";
import { buildDeployModuleTask, defineInputUpdate } from "@/util/terragrunt/tasks/deployModuleTask";
import type { PanfactumContext } from "@/util/context/context";


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

    if ((await getModuleStatus({
        context,
        environment: MANAGEMENT_ENVIRONMENT,
        region: GLOBAL_REGION,
        module: MODULES.IAM_IDENTIY_CENTER_PERMISSIONS
    })).deploy_status !== "success") {
        context.logger.debug("Skipping IAM Identity center update as it is not deployed")
    }

    if (await fileContains({ context, filePath: moduleHCLPath, regex: /account_access_configuration\s*=/ })) {
        context.logger.warn(
            `You have IAM Identity Center deployed, but you are configuring it via \`terragrunt.hcl\` input rather than using \`module.yaml\`.
            As a result, this installer cannot automatically update the settings.`
        )
        return
    }

    context.logger.info("Setting up SSO for the new AWS account")


    /////////////////////////////////////////////////////////////////////
    // Save the Access Key, so we can deprovision it (if necessary)
    /////////////////////////////////////////////////////////////////////
    const creds = await getCredsFromFile({ context, profile: environmentProfile })

    /////////////////////////////////////////////////////////////////////
    // Run the tasks
    /////////////////////////////////////////////////////////////////////

    const tasks = new Listr<TaskContext>([
        {
            title: context.logger.applyColors(`Retrieve AWS account ID for ${environmentName} environment`),
            task: async (ctx, task) => {
                task.title = context.logger.applyColors(`Retrieving AWS account ID for ${environmentName} environment`)
                const identity = await getIdentity({ context, profile: environmentProfile }).catch((e) => {
                    throw new CLIError(`Was not able to get identity for environment's profile '${environmentProfile}'`, e)
                })
                ctx.accountId = identity.Account
                if (!ctx.accountId) {
                    throw new CLIError(`Was not able to get identity for environment's profile '${environmentProfile}'`)
                }
                task.title = context.logger.applyColors(
                    `Retrieved AWS account ID for ${environmentName} environment ${ctx.accountId}`,
                    {
                        lowlights: [ctx.accountId]
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

                const permissions = [
                    "superuser",
                    "admin (read / write)",
                    "read-only (including secrets)",
                    "read-only (NOT including secrets)"
                ] as const

                for (const group of authentikGroups) {
                    context.logger.addIdentifier(group)
                }
                for (const permission of permissions) {
                    context.logger.addIdentifier(permission)
                }

                const generateQuestionText = (permissions: string) => {
                    return `Select Authentik groups which will have ${permissions} access to the ${environmentName} environment`
                }

                const possibleSuperuserGroups = authentikGroups
                ctx.superuserGroups = await context.logger.checkbox({
                    message: generateQuestionText(permissions[0]),
                    choices: possibleSuperuserGroups.map(group => ({ name: group, value: group, checked: group === "superusers" })),
                    validate: (choices) => {
                        if (choices.findIndex(el => el.value === "superusers" && el.checked) === -1) {
                            return `The superusers group must always have superuser access to all environments`
                        } else {
                            return true
                        }
                    },
                    task
                })
                const possibleAdminGroups = possibleSuperuserGroups.filter(group => !ctx.superuserGroups.includes(group))
                if (possibleAdminGroups.length > 0) {
                    ctx.adminGroups = await context.logger.checkbox({
                        message: generateQuestionText(permissions[1]),
                        choices: possibleAdminGroups.map(group => ({ name: group, value: group })),
                        task
                    })

                    const possibleReaderGroups = possibleAdminGroups.filter(group => !ctx.adminGroups.includes(group))
                    if (possibleReaderGroups.length > 0) {
                        ctx.readerGroups = await context.logger.checkbox({
                            message: generateQuestionText(permissions[2]),
                            choices: possibleReaderGroups.map(group => ({ name: group, value: group })),
                            task
                        })
                        const possibleRestrictedReaderGroups = possibleReaderGroups.filter(group => !ctx.readerGroups.includes(group))
                        if (possibleRestrictedReaderGroups.length > 0) {
                            ctx.restrictedReaderGroups = await context.logger.checkbox({
                                message: generateQuestionText(permissions[3]),
                                choices: possibleRestrictedReaderGroups.map(group => ({ name: group, value: group })),
                                task
                            })
                        }
                    }
                }

                for (const group of authentikGroups) {
                    context.logger.removeIdentifier(group)
                }
                for (const permission of permissions) {
                    context.logger.removeIdentifier(permission)
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
                        if (!ctx.accountId) {
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
        await buildSyncAWSIdentityCenterTask({ context }),
        {
            title: context.logger.applyColors(`Revoke static IAM credentials ${creds?.accessKeyId}`, { lowlights: [creds!.accessKeyId] }),
            enabled: () => Boolean(creds?.accessKeyId),
            task: async () => {
                const iamClient = new IAMClient({
                    region: "us-east-1",
                    credentials: creds
                })

                // Delete the access key
                await iamClient.send(new DeleteAccessKeyCommand({
                    AccessKeyId: creds!.accessKeyId
                })).catch((error) => {
                    throw new CLIError(`Failed to revoke IAM access key ${creds!.accessKeyId}`, error)
                })
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
