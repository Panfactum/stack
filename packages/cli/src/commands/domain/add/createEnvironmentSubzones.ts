import type { PanfactumContext } from "@/context/context";
import { applyColors } from "@/util/colors/applyColors";
import { getEnvironments, type EnvironmentMeta } from "@/util/config/getEnvironments";
import { MANAGEMENT_ENVIRONMENT } from "@/util/terragrunt/constants";
import { getEnvironmentsForSubzones } from "./getEnvironmentsForSubzones";
import { createDescendentZonesAndConnectToAncestor } from "./createDescendentZonesAndConnectToAncestor";
import type { DomainConfig } from "@/util/domains/tasks/types";

export async function createEnvironmentSubzones(inputs: {
    context: PanfactumContext,
    ancestorDomainConfig: DomainConfig;
}){

    const {context, ancestorDomainConfig} = inputs;
    const {domain, envName} = ancestorDomainConfig;

    const environments = await getEnvironments(context);

    // TODO: If the ancestor domain looks like an environment subdomain
    // (e.g., `dev.panfactum.com`), then we should skip this prompt
    // entirely b/c it woulnd't make sense to have `dev.dev.panfactum.com`

    // TODO: Verify if subzones are already setup
    const possibleSubzoneEnvironments = environments.filter(env => 
        env.name !== MANAGEMENT_ENVIRONMENT && env.name !== envName
    )

    if (possibleSubzoneEnvironments.length > 0) {
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
                `If you skip this step, only workloads deployed in the ${envName} environment would\n`+
                `be able to utilize ${domain} or its subdomains.`,
                {
                    style: "warning",
                    highlights: [envName, domain]
                }),
            { trailingNewlines: 1 }
        )

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

            await createDescendentZonesAndConnectToAncestor({
                context,
                ancestorZone: ancestorDomainConfig,
                descendentZones: Object.fromEntries(environmentsForSubzones.map(env => ([`${env.subdomain}.${domain}`, { env }])))
            })

            context.logger.log(
                    environmentsForSubzones.map(env =>applyColors(
                        `${env.subdomain}.${domain} added to ${env.name} successfully!`,
                        { style: "success", highlights: [`${env.subdomain}.${domain}`, env.name] })),
                        {trailingNewlines: 1, leadingNewlines: 1}
            )
        } else {
            context.logger.log(
                "Skipping environment subzone setup.",
                { trailingNewlines: 1 }
            )
        }
    } 

}