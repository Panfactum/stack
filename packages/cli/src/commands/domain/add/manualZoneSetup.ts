import { confirm } from "@inquirer/prompts"
import { ListrInquirerPromptAdapter } from "@listr2/prompt-adapter-inquirer";
import { Listr } from "listr2";
import { z, ZodError } from "zod";
import awsDNSZonesModuleHCL from "@/templates/aws_dns_zones.hcl" with { type: "file" };
import { applyColors } from "@/util/colors/applyColors";
import { testDNSResolutionTask } from "@/util/domains/tasks/testDNSResolutionTask";
import { validateDomainConfig, type DomainConfig, type DomainConfigs } from "@/util/domains/tasks/types";
import { CLIError, PanfactumZodError } from "@/util/error/error";
import { GLOBAL_REGION, MODULES } from "@/util/terragrunt/constants";
import { buildDeployModuleTask, defineInputUpdate } from "@/util/terragrunt/tasks/deployModuleTask";
import { terragruntOutput } from "@/util/terragrunt/terragruntOutput";
import { DNS_ZONES_MODULE_OUTPUT_SCHEMA } from "./types";
import type { PanfactumContext } from "@/context/context";
import type { EnvironmentMeta } from "@/util/config/getEnvironments";

interface TaskContext {
    nameServers: string[]
}

export async function manualZoneSetup(inputs: {
    context: PanfactumContext,
    domain: string;
    env: EnvironmentMeta
}): Promise<DomainConfig> {

    const { context, domain, env } = inputs;

    const tasks = new Listr<TaskContext>([])
    const domainConfig: Partial<DomainConfig> = {
        env,
        domain,
        module: MODULES.AWS_DNS_ZONES
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
            taskTitle: applyColors(`Deploy DNS zone for ${domain}`, { highlights: [domain] }),
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
        title: "Set NS (nameserver) records with registrar",
        task: async (ctx, task) => {
            task.output = applyColors(
                `To connect ${domain} to the Panfactum installation, you need to add\n` +
                `the following NS records to your domain registrar.\n\n` +
                ctx.nameServers.map(ns => `- ${ns}`).join("\n") + "\n" +
                `As an example, here are the steps that you would follow if you use Namecheap as the registrar:\n` +
                `https://www.namecheap.com/support/knowledgebase/article.aspx/767/10/how-to-change-dns-for-a-domain/`
                , { style: "warning" })

            let confirmRecordsAdded = false
            while (!confirmRecordsAdded) {
                confirmRecordsAdded = await task.prompt(ListrInquirerPromptAdapter).run(confirm, {
                    message: applyColors(`Have you added the NS (nameserver) records?`, { style: "question" }),
                    default: true
                })
            }
        }
    })

    ///////////////////////////////////////////////////////
    // Test DNS Resolution
    ///////////////////////////////////////////////////////

    tasks.add(await testDNSResolutionTask({
        context,
        zones: {[domain]: domainConfig} as DomainConfigs
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

        context.logger.log(
            applyColors(
                `${domain} added to ${env.name} successfully!`,
                { style: "success", highlights: [`${env.subdomain}.${domain}`, env.name] }),
                {trailingNewlines: 1}
    )
    } catch (e) {
        throw new CLIError(`Failed to setup zone for ${domain}`, e)
    }

    try {
        return validateDomainConfig(domainConfig)
    } catch(e){
        if (e instanceof ZodError){
            throw new PanfactumZodError("Failed to parse domain config", "manualZoneSetup", e)
        } else {
            throw new CLIError("Failed to parse domain config", e)
        }
    }
}