import { join, dirname } from "node:path";
import { Glob } from "bun";
import { type ListrTask } from "listr2";
import { z } from "zod";
import { getPanfactumConfig } from "@/commands/config/get/getPanfactumConfig";
import { CLIError } from "@/util/error/error";
import { createDirectory } from "@/util/fs/createDirectory";
import { getLastPathSegments } from "@/util/getLastPathSegments";
import { MODULES } from "@/util/terragrunt/constants";
import { terragruntOutput } from "@/util/terragrunt/terragruntOutput";
import type { PanfactumContext } from "@/context/context";

interface TaskContext {
    bastionInfo: {
        domain: string;
        publicKey: string;
        port: number;
        name: string;
    }[]
}

export async function buildSyncSSHTask<T extends {}>(inputs: { context: PanfactumContext, exitOnError?: false }): Promise<ListrTask<T>> {

    const { context, exitOnError = false } = inputs;


    const BASTION_MODULE_OUTPUT_SCHEMA = z.object({
        bastion_host_public_key: z.object({
            sensitive: z.boolean(),
            type: z.string(),
            value: z.string(),
        }),
        bastion_domains: z.object({
            sensitive: z.boolean(),
            type: z.array(z.string()),
            value: z.array(z.string()).min(1),
        }),
        bastion_port: z.object({
            sensitive: z.boolean(),
            type: z.string(),
            value: z.number(),
        }),
    })

    const EKS_MODULE_OUTPUT_SCHEMA = z.object({
        cluster_name: z.object({ value: z.string() }),
    })

    return {
        title: "Sync SSH Bastion connection info to DevShell",
        task: async (_, parentTask) => {

            const { ssh_dir: sshDir, environments_dir: environmentsDir } = context.repoVariables;


            ///////////////////////////////////////////////////////
            // Check if there are any bastion modules; if no, skip
            ///////////////////////////////////////////////////////
            const glob = new Glob(join(environmentsDir, "**", MODULES.KUBE_BASTION, "terragrunt.hcl"));
            const bastionHCLPaths = Array.from(glob.scanSync(environmentsDir));
            if (bastionHCLPaths.length === 0) {
                parentTask.skip(context.logger.applyColors("Skipped sync SSH Bastion connection info to DevShell No bastions found", {
                    lowlights: [
                        "No bastions found"
                    ]
                }))
                return
            }

            await createDirectory(sshDir)
            const subtasks = parentTask.newListr<TaskContext>([], {
                ctx: {
                    bastionInfo: []
                },
                rendererOptions: {
                    collapseErrors: false
                }
            })

            ///////////////////////////////////////////////////////
            // Add subtasks for fetching the module outputs
            ///////////////////////////////////////////////////////
            bastionHCLPaths.forEach((bastionHCLPath) => {
                const moduleDirectory = dirname(bastionHCLPath);
                const bastionId = getLastPathSegments(moduleDirectory, 3);
                subtasks.add({
                    title: context.logger.applyColors(`Retrieve bastion info ${bastionId}`, { lowlights: [bastionId] }),
                    task: async (ctx, task) => {
                        try {
                            const { environment_dir: envDir, region_dir: regionDir } = await getPanfactumConfig({ context, directory: moduleDirectory })

                            if (!envDir) {
                                throw new CLIError("Module is not in a valid environment directory.")
                            } else if (!regionDir) {
                                throw new CLIError("Module is not in a valid region directory.")
                            }

                            const [bastionModuleOutput, eksModuleOutput] = await Promise.all([
                                terragruntOutput({
                                    context,
                                    environment: envDir,
                                    region: regionDir,
                                    module: MODULES.KUBE_BASTION,
                                    validationSchema: BASTION_MODULE_OUTPUT_SCHEMA,
                                }),
                                terragruntOutput({
                                    context,
                                    environment: envDir,
                                    region: regionDir,
                                    module: MODULES.AWS_EKS,
                                    validationSchema: EKS_MODULE_OUTPUT_SCHEMA,
                                })
                            ])

                            const domain = bastionModuleOutput.bastion_domains.value[0]!;
                            const publicKey = bastionModuleOutput.bastion_host_public_key.value;
                            const port = bastionModuleOutput.bastion_port.value;
                            const name = eksModuleOutput.cluster_name.value

                            ctx.bastionInfo.push({
                                domain,
                                publicKey,
                                port,
                                name
                            })
                        } catch (e) {
                            if (exitOnError) {
                                throw e
                            } else {
                                task.skip(context.logger.applyColors(`Failed to retrieve bastion info ${bastionId}`, { style: "error", lowlights: [bastionId] }))
                                parentTask.title = context.logger.applyColors("Sync SSH Bastion connection info to DevShell Partial Failure", { badlights: ["Partial Failure"] })
                            }
                        }
                    },
                })
            })

            ///////////////////////////////////////////////////////
            // Write the configuration files
            ///////////////////////////////////////////////////////
            subtasks.add({
                title: "Syncing DevShell configuration",
                task: async (ctx) => {
                    const knownHostsLines: string[] = []
                    const connectionInfoLines: string[] = []
                    for (const { name, domain, publicKey, port } of ctx.bastionInfo) {
                        knownHostsLines.push(`[${domain}]:${port} ${publicKey}`);
                        connectionInfoLines.push(`${name} ${domain} ${port}`);
                    }
                    await Promise.all([
                        Bun.write(Bun.file(join(sshDir, "known_hosts")), knownHostsLines.join("\n")),
                        Bun.write(
                            Bun.file(join(sshDir, "connection_info")),
                            connectionInfoLines.join("\n")
                        ),
                    ]);
                }
            })

            return subtasks;
        }
    }
}