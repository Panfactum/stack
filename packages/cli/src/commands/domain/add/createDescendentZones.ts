import { join } from "node:path"
import { Listr } from "listr2";
import { z, ZodError } from "zod";

import awsDNSLinksModuleHCL from "@/templates/aws_dns_links.hcl" with { type: "file" };
import awsDNSZonesModuleHCL from "@/templates/aws_dns_zones.hcl" with { type: "file" };
import { upsertConfigValues } from "@/util/config/upsertConfigValues";
import { validateDomainConfig, validateDomainConfigs, type DomainConfig, type DomainConfigs } from "@/util/domains/tasks/types";
import { CLIError, PanfactumZodError } from "@/util/error/error";
import { runTasks } from "@/util/listr/runTasks";
import { GLOBAL_REGION, MODULES } from "@/util/terragrunt/constants";
import { buildDeployModuleTask, defineInputUpdate } from "@/util/terragrunt/tasks/deployModuleTask";
import { terragruntOutput } from "@/util/terragrunt/terragruntOutput";

import { DNS_ZONES_MODULE_OUTPUT_SCHEMA } from "./types";
import { testDNSResolutionTask } from "../../../util/domains/tasks/testDNSResolutionTask";
import type { EnvironmentMeta } from "@/util/config/getEnvironments";
import type { PanfactumContext } from "@/util/context/context";

export async function createDescendentZones(inputs: {
    context: PanfactumContext,
    ancestorZone: DomainConfig,
    descendentZones: { [domain: string]: { env: EnvironmentMeta } }
}): Promise<DomainConfigs> {

    const { context, ancestorZone, descendentZones } = inputs;

    const tasks = new Listr([], { rendererOptions: { collapseErrors: false } })
    const domainConfigs: { [domain in keyof DomainConfigs]: Partial<DomainConfig> } = Object.fromEntries(Object.entries(descendentZones).map(([domain, { env }]) => ([domain, {
        env: env,
        module: MODULES.AWS_DNS_ZONES,
        domain
    }])))

    ///////////////////////////////////////////////////////
    // Connect zones
    ///////////////////////////////////////////////////////

    tasks.add({
        title: context.logger.applyColors(
            `Create and connect descendent DNS zones to ancestor ${ancestorZone.domain}`,
            { lowlights: [ancestorZone.domain] }
        ),
        task: async (_, grandParentTask) => {
            const subtasks = grandParentTask.newListr([])

            interface ConnectTask { nameServers?: string[], dsRecord?: string }
            for (const [domain, config] of Object.entries(descendentZones)) {
                subtasks.add({
                    title: context.logger.applyColors(
                        `Create and connect ${domain} ${config.env.name}`,
                        {
                            lowlights: [
                                config.env.name
                            ]
                        }
                    ),
                    task: async (_, parentTask) => {
                        const subsubtasks = parentTask.newListr<ConnectTask>([])

                        ///////////////////////////////////////////////
                        // Deploy descendent zone
                        ///////////////////////////////////////////////
                        subsubtasks.add(
                            await buildDeployModuleTask({
                                context,
                                environment: config.env.name,
                                region: GLOBAL_REGION,
                                module: MODULES.AWS_DNS_ZONES,
                                hclIfMissing: await Bun.file(awsDNSZonesModuleHCL).text(),
                                taskTitle: "Deploy zone",
                                inputUpdates: {
                                    domains: defineInputUpdate({
                                        schema: z.record(z.string(), z.object({
                                            dnssec_enabled: z.boolean().default(false)
                                        })),
                                        update: (oldDomains) => ({
                                            ...oldDomains,
                                            ...{
                                                [domain]: { dnssec_enabled: true }
                                            }
                                        })
                                    })
                                }
                            })
                        )

                        ///////////////////////////////////////////////
                        // Get NS and DNSSec Records
                        ///////////////////////////////////////////////
                        subsubtasks.add({
                            title: "Get DNS zone metadata",
                            task: async (ctx) => {
                                const moduleOutput = await terragruntOutput({
                                    context,
                                    environment: config.env.name,
                                    region: GLOBAL_REGION,
                                    module: MODULES.AWS_DNS_ZONES,
                                    validationSchema: DNS_ZONES_MODULE_OUTPUT_SCHEMA,
                                });

                                const zoneInfo = moduleOutput.zones.value[domain]

                                if (!zoneInfo) {
                                    throw new CLIError(`Could not find zone for ${domain} in module outputs`)
                                }

                                const domainConfig = domainConfigs[domain]
                                if (!domainConfig) {
                                    throw new CLIError("domainConfig not found. This should never occur.")

                                }

                                const { ds_record: dsRecord } = zoneInfo
                                if (!dsRecord) {
                                    throw new CLIError(`DS record not found on nearly created zone for ${domain}`)
                                }
                                ctx.dsRecord = dsRecord
                                ctx.nameServers = zoneInfo.name_servers

                                domainConfig.zoneId = zoneInfo.zone_id
                                domainConfig.recordManagerRoleARN = moduleOutput.record_manager_role_arn.value


                            }
                        })

                        ///////////////////////////////////////////////
                        // Link to parent
                        ///////////////////////////////////////////////
                        subsubtasks.add(
                            await buildDeployModuleTask<ConnectTask>({
                                context,
                                environment: ancestorZone.env.name,
                                region: GLOBAL_REGION,
                                module: MODULES.AWS_DNS_LINKS,
                                hclIfMissing: await Bun.file(awsDNSLinksModuleHCL).text(),
                                taskTitle: context.logger.applyColors(`Deploy NS and DNSSEC records in ${ancestorZone.domain}`),
                                inputUpdates: {
                                    links: defineInputUpdate({
                                        schema: z.record(z.string(), z.array(z.object({
                                            subdomain: z.string(),
                                            name_servers: z.array(z.string()),
                                            ds_record: z.string()
                                        }))),
                                        update: (oldLinks = {}, ctx) => {
                                            const subdomain = domain.slice(0, -ancestorZone.domain.length - 1)
                                            const newLinksForAncestor = (oldLinks[ancestorZone.domain] ?? [])
                                                .filter(link => link.subdomain !== subdomain)
                                                .concat([{
                                                    subdomain,
                                                    name_servers: ctx.nameServers!,
                                                    ds_record: ctx.dsRecord!
                                                }])
                                            return {
                                                ...oldLinks,
                                                ...{
                                                    [ancestorZone.domain]: newLinksForAncestor
                                                }
                                            }
                                        }
                                    })
                                }
                            })
                        )

                        return subsubtasks;
                    }
                })
            }
            return subtasks
        }
    })

    ///////////////////////////////////////////////////////
    // Test DNS Resolution
    ///////////////////////////////////////////////////////

    tasks.add(await testDNSResolutionTask({
        context,
        zones: { ...domainConfigs, verifyDNSSEC: true } as DomainConfigs & { verifyDNSSEC: boolean }
    }))

    ///////////////////////////////////////////////////////
    // Add to environment.yaml
    ///////////////////////////////////////////////////////
    tasks.add({
        title: "Update DevShell",
        task: async () => {
            await Promise.all(Object.entries(domainConfigs).map(async ([domain, domainConfig]) => {
                const validatedDomainConfig = validateDomainConfig(domainConfig)
                await upsertConfigValues({
                    context,
                    filePath: join(validatedDomainConfig.env.path, "environment.yaml"),
                    values: {
                        domains: {
                            [domain]: {
                                zone_id: validatedDomainConfig.zoneId,
                                record_manager_role_arn: validatedDomainConfig.recordManagerRoleARN
                            }
                        }
                    }
                })
            }))
        }
    })

    ///////////////////////////////////////////////////////
    // Update clusters
    ///////////////////////////////////////////////////////
    // TODO: @jack - Update clusters

    ///////////////////////////////////////////////////////
    // Run Tasks
    ///////////////////////////////////////////////////////

    await runTasks({
        context,
        tasks,
        errorMessage: "Failed to create descendent DNS zones"
    })

    try {
        return validateDomainConfigs(domainConfigs)
    } catch (e) {
        if (e instanceof ZodError) {
            throw new PanfactumZodError("Failed to parse domain configs", "createDescendentZones", e)
        } else {
            throw new CLIError("Failed to parse dependent zones", e)
        }
    }

}