import { join, dirname } from "node:path"
import { Glob } from "bun";
import { z } from "zod";
import { getPanfactumConfig } from "@/util/config/getPanfactumConfig";
import { isEnvironmentDeployed } from "@/util/config/isEnvironmentDeployed";
import { getRegisteredDomainsTask } from "./getRegisteredDomainsTask";
import { CLIError } from "../../error/error";
import { MODULES } from "../../terragrunt/constants";
import { terragruntOutput } from "../../terragrunt/terragruntOutput";
import type { DomainConfigs } from "./types";
import type { PanfactumContext } from "@/util/context/context";
import type { ListrTask } from "listr2";

export async function getZonesTask<T extends {}>(inputs: {
    context: PanfactumContext
}): Promise<{ task: ListrTask<T>, domainConfigs: DomainConfigs }> {

    const { context } = inputs;

    const { environments_dir: environmentsDir } = inputs.context.repoVariables;
    const domainConfigs: DomainConfigs = {}
    return {
        domainConfigs,
        task: {
            title: "Retrieve DNS zone info",
            task: async (_, parentTask) => {
                const subtasks = parentTask.newListr([])


                ////////////////////////////////////////////////////////
                // Get Zones from registered domains module
                ////////////////////////////////////////////////////////
                const { task: registeredDomainsTask, domainConfigs: registeredDomainsConfigs } = await getRegisteredDomainsTask<T>({ context })
                subtasks.add(registeredDomainsTask)

                ////////////////////////////////////////////////////////
                // Get Zones from dns_zones module
                ////////////////////////////////////////////////////////
                const dnsZoneDomainConfigs: DomainConfigs = {}
                subtasks.add({
                    title: "Get other DNS zones",
                    task: async (_, subtask) => {

                        const subsubtasks = subtask.newListr([], { concurrent: true })

                        const DNS_ZONES_MODULE_OUTPUT_SCHEMA = z.object({
                            zones: z.object({
                                value: z.record(z.string(), z.object({
                                    zone_id: z.string()
                                }))
                            }),
                            record_manager_role_arn: z.object({
                                value: z.string()
                            })
                        })
                        const glob = new Glob(join(environmentsDir, "*", "*", MODULES.AWS_DNS_ZONES, "terragrunt.hcl"));
                        const domainModuleHCLPaths = Array.from(glob.scanSync(environmentsDir));
                        for (const hclPath of domainModuleHCLPaths) {
                            const moduleDirectory = dirname(hclPath);
                            const { environment_dir: envDir, region_dir: regionDir, environment } = await getPanfactumConfig({ context, directory: moduleDirectory })
                            if (!envDir) {
                                throw new CLIError("Module is not in a valid environment directory.")
                            } else if (!regionDir) {
                                throw new CLIError("Module is not in a valid region directory.")
                            } else if (!environment) {
                                throw new CLIError("Environment is unknown")
                            }
                            subsubtasks.add({
                                title: `Get ${environment} zones`,
                                task: async (_, task) => {
                                    try {
                                        const deployed = await isEnvironmentDeployed({ context, environment })
                                        const moduleOutput = await terragruntOutput({
                                            context,
                                            environment: envDir,
                                            region: regionDir,
                                            module: MODULES.AWS_DNS_ZONES,
                                            validationSchema: DNS_ZONES_MODULE_OUTPUT_SCHEMA,
                                        });

                                        Object.entries(moduleOutput.zones.value).forEach(([domain, { zone_id: zoneId }]) => {
                                            dnsZoneDomainConfigs[domain] = {
                                                domain,
                                                zoneId,
                                                recordManagerRoleARN: moduleOutput.record_manager_role_arn.value,
                                                env: {
                                                    name: environment!,
                                                    path: envDir,
                                                    deployed
                                                },
                                            }
                                        })
                                    } catch {
                                        task.skip(context.logger.applyColors(`Get ${environment} zones Failure`, { badlights: ["Failure"] }))
                                        parentTask.title = context.logger.applyColors(`Retrieve DNS zone info Partial failure`, { badlights: ["Partial failure"] })
                                    }
                                }
                            })
                        }
                        return subsubtasks
                    }
                })

                ////////////////////////////////////////////////////////
                // Merge results
                ////////////////////////////////////////////////////////
                subtasks.add({
                    title: "Merge results",
                    task: () => {
                        Object.entries(registeredDomainsConfigs).forEach(([domain, config]) => {
                            domainConfigs[domain] = config
                        });
                        Object.entries(dnsZoneDomainConfigs).forEach(([domain, config]) => {
                            domainConfigs[domain] = config
                        });
                    }
                })
                return subtasks;
            }
        }

    }
}