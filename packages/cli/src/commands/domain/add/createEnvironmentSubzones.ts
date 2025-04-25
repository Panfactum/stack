import { applyColors } from "@/util/colors/applyColors";
import { getEnvironments } from "@/util/config/getEnvironments";
import { MANAGEMENT_ENVIRONMENT } from "@/util/terragrunt/constants";
import { createDescendentZones } from "./createDescendentZones";
import { getEnvironmentsForSubzones } from "./getEnvironmentsForSubzones";
import { manualZoneSetup } from "./manualZoneSetup";
import type { PanfactumContext } from "@/context/context";
import type { DomainConfigs } from "@/util/domains/tasks/types";

export async function createEnvironmentSubzones(inputs: {
    context: PanfactumContext,
    existingDomainConfigs: DomainConfigs;
    domain: string;
}) {

    const { context, domain, existingDomainConfigs } = inputs;
    const ancestorDomainConfig = existingDomainConfigs[domain]
    const environments = await getEnvironments(context);


    // If the ancestor domain looks like an environment subdomain
    // (e.g., `dev.panfactum.com`), then we should skip this prompt
    // entirely b/c it woulnd't make sense to have `dev.dev.panfactum.com`
    const envSubdomains = environments
        .map(env => env.subdomain)
        .filter(subdomain => subdomain !== undefined)
    const firstSegment = domain.split(".")[0]
    if (firstSegment && envSubdomains.includes(firstSegment)) {
        context.logger.log(
            applyColors(`Skipping environment subzone setup as ${domain} appears to already be an environment subdomain`, { highlights: [domain] }),
            { trailingNewlines: 1 }
        )
        return
    }

    // Scope down the possible environments
    const existingDomains = Object.keys(existingDomainConfigs);
    const possibleSubzoneEnvironments = environments.filter(env =>
        env.name !== MANAGEMENT_ENVIRONMENT && // DNS should not be configured for the management environment
        env.name !== ancestorDomainConfig?.env.name && // We don't need to create a subdomain zone for the environment where the ancestor exists (access is implicit)
        (env.subdomain === undefined || !existingDomains.includes(`${env.subdomain}.${domain}`)) // We shouldn't include environments where the env-speicifc domain that would be created already exists
    )

    // If no environments eligible for subdomains, we can skip this.
    if (possibleSubzoneEnvironments.length === 0) {
        context.logger.log(
            "Skipping environment subzone setup as no eligible environments.",
            { trailingNewlines: 1 }
        )
    }

    if (ancestorDomainConfig) {
        context.logger.log(
            applyColors(
                `We recommend setting up environment-specific DNS subzones.\n` +
                `This would allow you to host workloads in other environments that utilize\n` +
                `a subdomain of ${domain}. For example: api.dev.${domain}`,
                {
                    highlights: [`api.dev.${domain}`, domain]
                }),
            { trailingNewlines: 1 }
        )

        context.logger.log(
            applyColors(
                `If you skip this step, only workloads deployed in the ${ancestorDomainConfig.env.name} environment would\n` +
                `be able to utilize ${domain} or its subdomains.`,
                {
                    style: "warning",
                    highlights: [ancestorDomainConfig.env.name, domain]
                }),
            { trailingNewlines: 1 }
        )

    } else {
        context.logger.log(
            applyColors(
                `Even though you've opted to not add ${domain} to Panfactum,\n` +
                `you can still set up environment-specific DNS subzones.\n` +
                `This would allow you to host workloads that utilize\n` +
                `a subdomain of ${domain}. For example: api.dev.${domain}`,
                {
                    highlights: [`api.dev.${domain}`, domain]
                }),
            { trailingNewlines: 1 }
        )

        context.logger.log(
            applyColors(
                `If you skip this step, you will not be able to deploy any workloads that\n` +
                `utilize ${domain} or any of its subdomains.`,
                {
                    style: "warning",
                    highlights: [domain]
                }),
            { trailingNewlines: 1 }
        )
    }


    const environmentsForSubzones = await getEnvironmentsForSubzones({
        context,
        possibleEnvironments: possibleSubzoneEnvironments,
        ancestorDomain: domain
    })

    if (environmentsForSubzones.length > 0) {
        context.logger.log(
            applyColors(`Deploying subzones for ${domain}...`, { highlights: [domain] }),
            { trailingNewlines: 1, leadingNewlines: 1 }
        )

        if (ancestorDomainConfig) {
            await createDescendentZones({
                context,
                ancestorZone: ancestorDomainConfig,
                descendentZones: Object.fromEntries(environmentsForSubzones.map(env => ([`${env.subdomain}.${domain}`, { env }])))
            })
            context.logger.log(
                environmentsForSubzones.map(env => applyColors(
                    `${env.subdomain}.${domain} added to ${env.name} successfully!`,
                    { style: "success", highlights: [`${env.subdomain}.${domain}`, env.name] })),
                { trailingNewlines: 1, leadingNewlines: 1 }
            )
        } else {
            for (const env of environmentsForSubzones) {
                await manualZoneSetup({
                    context,
                    env,
                    domain: `${env.subdomain}.${domain}`
                })
            }
        }

    }
}