import { ChangeResourceRecordSetsCommand, Route53Client } from "@aws-sdk/client-route-53";
import { Listr } from "listr2";
import { z } from "zod";

import { getPanfactumConfig } from "@/commands/config/get/getPanfactumConfig";
import awsDNSLinksModuleHCL from "@/templates/aws_dns_links.hcl" with { type: "file" };
import awsDNSZonesModuleHCL from "@/templates/aws_dns_zones.hcl" with { type: "file" };
import { getIdentity } from "@/util/aws/getIdentity";
import { applyColors } from "@/util/colors/applyColors";
import { CLIError } from "@/util/error/error";
import { execute } from "@/util/subprocess/execute";
import { GLOBAL_REGION, MODULES } from "@/util/terragrunt/constants";
import { buildDeployModuleTask, defineInputUpdate } from "@/util/terragrunt/tasks/deployModuleTask";
import { terragruntOutput } from "@/util/terragrunt/terragruntOutput";

import type { PanfactumContext } from "@/context/context";
import type { EnvironmentMeta } from "@/util/config/getEnvironments";
import type { DomainConfig, DomainConfigs } from "@/util/domains/tasks/types";
import { testDNSResolutionTask } from "./testDNSResolutionTask";
import { DNS_ZONES_MODULE_OUTPUT_SCHEMA } from "./types";

export async function createDescendentZonesAndConnectToAncestor(inputs: {
    context: PanfactumContext,
    ancestorZone: DomainConfig,
    descendentZones: { [domain: string]: { env: EnvironmentMeta } }
}): Promise<DomainConfigs> {

    const { context, ancestorZone, descendentZones } = inputs;

    interface ZoneInfo { [domain: string]: { zoneId?: string, env: EnvironmentMeta } }
    const descendentZoneInfo: ZoneInfo = {...descendentZones}
    const tasks = new Listr([])

    ///////////////////////////////////////////////////////
    // Connect zones
    ///////////////////////////////////////////////////////

    tasks.add({
        title: applyColors(
            `Create and connect descendent DNS zones to ancestor ${ancestorZone.domain}`,
            { highlights: [{ phrase: ancestorZone.domain, style: "subtle" }] }
        ),
        task: async (_, grandParentTask) => {
            const subtasks = grandParentTask.newListr([])

            interface ConnectTask { nameServers?: string[] }
            for (const [domain, config] of Object.entries(descendentZones)) {
                subtasks.add({
                    title: applyColors(
                        `Create and connect ${domain} ${config.env.name}`,
                        {
                            highlights: [
                                { phrase: config.env.name, style: "subtle" },
                                { phrase: domain, style: "important" }
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
                                taskTitle: "Deploy descendent zone",
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

                                const domainInfo = descendentZoneInfo[domain]
                                if(domainInfo){
                                    domainInfo.zoneId = zoneInfo.zone_id
                                }
                               
                                ctx.nameServers = zoneInfo.name_servers
                            }
                        })

                        ///////////////////////////////////////////////
                        // Link to parent
                        ///////////////////////////////////////////////
                        // TODO: DNSSEC
                        subsubtasks.add(
                            await buildDeployModuleTask<ConnectTask>({
                                context,
                                environment: ancestorZone.envName,
                                region: GLOBAL_REGION,
                                module: MODULES.AWS_DNS_LINKS,
                                hclIfMissing: await Bun.file(awsDNSLinksModuleHCL).text(),
                                taskTitle: applyColors(`Deploy NS and DNSSEC records in ${ancestorZone.domain}`, { highlights: [ancestorZone.domain] }),
                                inputUpdates: {
                                    links: defineInputUpdate({
                                        schema: z.record(z.string(), z.array(z.object({
                                            subdomain: z.string(),
                                            name_servers: z.array(z.string())
                                        }))),
                                        update: (oldLinks = {}, ctx) => {
                                            const subdomain = domain.slice(0, -ancestorZone.domain.length - 1)
                                            const newLinksForAncestor = (oldLinks[ancestorZone.domain] ?? [])
                                                .filter(link => link.subdomain !== subdomain)
                                                .concat([{
                                                    subdomain,
                                                    name_servers: ctx.nameServers!
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
        zones: descendentZoneInfo
    }))

    ///////////////////////////////////////////////////////
    // Add to clusters
    ///////////////////////////////////////////////////////
    // TODO

    ///////////////////////////////////////////////////////
    // Run Tasks
    ///////////////////////////////////////////////////////
    try {
        await tasks.run()
    } catch (e) {
        throw new CLIError("Failed to link ancestor and descendent DNS zones", e)
    }

}