import { join } from "node:path"
import { Listr } from "listr2";
import { z, ZodError } from "zod";
import awsDNSZonesModuleHCL from "@/templates/aws_dns_zones.hcl" with { type: "file" };
import { upsertConfigValues } from "@/util/config/upsertConfigValues";
import { testDNSResolutionTask } from "@/util/domains/tasks/testDNSResolutionTask";
import { validateDomainConfig, type DomainConfig, type DomainConfigs } from "@/util/domains/tasks/types";
import { CLIError, PanfactumZodError } from "@/util/error/error";
import { runTasks } from "@/util/listr/runTasks";
import { GLOBAL_REGION, MODULES } from "@/util/terragrunt/constants";
import { buildDeployModuleTask, defineInputUpdate } from "@/util/terragrunt/tasks/deployModuleTask";
import { terragruntOutput } from "@/util/terragrunt/terragruntOutput";
import { DNS_ZONES_MODULE_OUTPUT_SCHEMA } from "./types";
import type { EnvironmentMeta } from "@/util/config/getEnvironments";
import type { PanfactumContext } from "@/util/context/context";

interface TaskContext {
    nameServers: string[]
}

export async function manualZoneSetup(inputs: {
    context: PanfactumContext,
    domain: string;
    env: EnvironmentMeta;
    isApex?: boolean;
}): Promise<DomainConfig> {

    const { context, domain, env, isApex } = inputs;

    const tasks = new Listr<TaskContext>([], { rendererOptions: { collapseErrors: false } })
    const domainConfig: Partial<DomainConfig> = {
        env,
        domain,
    }

    ///////////////////////////////////////////////
    // Deploy new zone for domain
    ///////////////////////////////////////////////
    tasks.add(
        await buildDeployModuleTask({
            context,
            environment: env.name,
            region: GLOBAL_REGION,
            module: MODULES.AWS_DNS_ZONES,
            hclIfMissing: await Bun.file(awsDNSZonesModuleHCL).text(),
            taskTitle: `Deploy DNS zone for ${domain}`,
            inputUpdates: {
                domains: defineInputUpdate({
                    schema: z.record(z.string(), z.object({
                        dnssec_enabled: z.boolean().default(false)
                    })),
                    update: (oldDomains) => ({
                        ...oldDomains,
                        ...{
                            [domain]: { dnssec_enabled: false }
                        }
                    })
                })
            }
        })
    )

    ///////////////////////////////////////////////
    // Get NS Records
    ///////////////////////////////////////////////
    tasks.add({
        title: "Get DNS zone metadata",
        task: async (ctx) => {
            const moduleOutput = await terragruntOutput({
                context,
                environment: env.name,
                region: GLOBAL_REGION,
                module: MODULES.AWS_DNS_ZONES,
                validationSchema: DNS_ZONES_MODULE_OUTPUT_SCHEMA,
            });

            const zoneInfo = moduleOutput.zones.value[domain]

            if (!zoneInfo) {
                throw new CLIError(`Could not find zone for ${domain} in module outputs`)
            }
            ctx.nameServers = zoneInfo.name_servers

            domainConfig.recordManagerRoleARN = moduleOutput.record_manager_role_arn.value
            domainConfig.zoneId = zoneInfo.zone_id
        }
    })

    ///////////////////////////////////////////////
    // Set NS Records
    ///////////////////////////////////////////////
    tasks.add({
        title: isApex ? "Set nameservers with DNS registrar" : "Add NS (nameserver) records to DNS host",
        task: async (ctx, task) => {
            let confirmRecordsAdded = false
            while (!confirmRecordsAdded) {
                if (isApex) {
                    task.output = context.logger.applyColors(
                        `To connect ${domain} to the Panfactum installation, you need to add\n` +
                        "the following nameservers to your DNS registrar.\n\n" +
                        "As an example, here are the steps that you would\n" +
                        "follow if you use Namecheap as the registrar:\n" +
                        "https://www.namecheap.com/support/knowledgebase/article.aspx/767/10/how-to-change-dns-for-a-domain/\n\n\n" +
                        `Nameservers:\n\n`
                        , { style: "warning" }) + context.logger.applyColors(ctx.nameServers.map(ns => `- ${ns}`).join("\n\n"), { style: 'warning' })
                    confirmRecordsAdded = await context.logger.confirm({
                        task,
                        message: `Have you added the nameservers? `,
                        default: true
                    })
                } else {
                    task.output = context.logger.applyColors(
                        `To connect ${domain} to the Panfactum installation, you need to add\n` +
                        "the following NS records to your DNS host.\n\n" +
                        "As an example, here are the steps that you would\n" +
                        "follow if you use Namecheap as the DNS host:\n" +
                        "https://www.namecheap.com/support/knowledgebase/article.aspx/434/2237/how-do-i-set-up-host-records-for-a-domain/\n\n\n" +
                        `Record Type: NS\n\n` +
                        `Record Name: ${domain}\n\n` +
                        `Record Values (Nameservers):\n\n`
                        , { style: "warning" }) + context.logger.applyColors(ctx.nameServers.map(ns => `- ${ns}`).join("\n\n"), { style: 'warning' })
                    confirmRecordsAdded = await context.logger.confirm({
                        task,
                        message: `Have you added the NS (nameserver) records? `,
                        default: true
                    })
                }
            }
        }
    })

    ///////////////////////////////////////////////////////
    // Test DNS Resolution
    ///////////////////////////////////////////////////////

    tasks.add(await testDNSResolutionTask({
        context,
        zones: { [domain]: domainConfig } as DomainConfigs
    }))

    ///////////////////////////////////////////////////////
    // Add to environment.yaml
    ///////////////////////////////////////////////////////
    tasks.add({
        title: "Update DevShell",
        task: async () => {

            const validatedDomainConfig = validateDomainConfig(domainConfig);
            await upsertConfigValues({
                context,
                filePath: join(env.path, "environment.yaml"),
                values: {
                    domains: {
                        [domain]: {
                            zone_id: validatedDomainConfig.zoneId,
                            record_manager_role_arn: validatedDomainConfig.recordManagerRoleARN
                        }
                    }
                }
            })
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
        errorMessage: `Failed to setup zone for ${domain}`
    })
    context.logger.success(`${domain} added to ${env.name} successfully!`)

    try {
        return validateDomainConfig(domainConfig)
    } catch (e) {
        if (e instanceof ZodError) {
            throw new PanfactumZodError("Failed to parse domain config", "manualZoneSetup", e)
        } else {
            throw new CLIError("Failed to parse domain config", e)
        }
    }
}