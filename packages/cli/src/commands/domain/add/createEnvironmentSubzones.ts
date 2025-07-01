import { getEnvironments } from "@/util/config/getEnvironments";
import { MANAGEMENT_ENVIRONMENT } from "@/util/terragrunt/constants";
import { createDescendentZones } from "./createDescendentZones";
import { getEnvironmentsForSubzones } from "./getEnvironmentsForSubzones";
import { manualZoneSetup } from "./manualZoneSetup";
import type { PanfactumContext } from "@/util/context/context";
import type { DomainConfigs } from "@/util/domains/tasks/types";

/**
 * Interface for createEnvironmentSubzones function inputs
 */
interface ICreateEnvironmentSubzonesInput {
    /** Panfactum context for operations */
    context: PanfactumContext;
    /** Existing domain configurations to update */
    existingDomainConfigs: DomainConfigs;
    /** Root domain name for subzone creation */
    domain: string;
}

/**
 * Creates environment-specific DNS subzones for a domain
 * 
 * @remarks
 * This function creates dedicated DNS subzones for each Panfactum environment,
 * enabling environment isolation and subdomain management. For example:
 * - dev.example.com for development environment
 * - staging.example.com for staging environment  
 * - prod.example.com for production environment
 * 
 * The process includes:
 * - Environment enumeration and filtering
 * - DNS zone delegation setup
 * - Cross-environment DNS configuration
 * - Terraform module deployment for each subzone
 * 
 * @param input - Configuration for subzone creation
 * 
 * @throws {@link CLIError}
 * Throws when environment discovery or DNS zone creation fails
 */
export async function createEnvironmentSubzones(input: ICreateEnvironmentSubzonesInput) {
    const { context, domain, existingDomainConfigs } = input;
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
        context.logger.info(`Skipping environment subzone setup as ${domain} appears to already be an environment subdomain`)
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
        context.logger.info("Skipping environment subzone setup as no eligible environments.")
        return
    }

    if (ancestorDomainConfig) {
        context.logger.info(`
            We recommend setting up environment-specific DNS subzones.
            This would allow you to host workloads in other environments that utilize
            a subdomain of ${domain}. For example: api.dev.${domain}
        `)

        context.logger.warn(`
            If you skip this step, only workloads deployed in the ${ancestorDomainConfig.env.name} environment would
            be able to utilize ${domain} or its subdomains.
        `)

    } else {
        context.logger.info(`
            Even though you've opted to not add ${domain} to Panfactum,
            you can still set up environment-specific DNS subzones.
            This would allow you to host workloads that utilize
            a subdomain of ${domain}. For example: api.dev.${domain}
        `)

        context.logger.warn(`
            If you skip this step, you will not be able to deploy any workloads that
            utilize ${domain} or any of its subdomains.
        `)
    }


    const environmentsForSubzones = await getEnvironmentsForSubzones({
        context,
        possibleEnvironments: possibleSubzoneEnvironments,
        ancestorDomain: domain
    })

    if (environmentsForSubzones.length > 0) {
        context.logger.info(`Deploying subzones for ${domain}...`)
        environmentsForSubzones.forEach(env =>
            context.logger.addIdentifier(`${env.subdomain}.${domain}`)
        )
        if (ancestorDomainConfig) {
            await createDescendentZones({
                context,
                ancestorZone: ancestorDomainConfig,
                descendentZones: Object.fromEntries(environmentsForSubzones.map(env => ([`${env.subdomain}.${domain} `, { env }])))
            })
            environmentsForSubzones.forEach(env =>
                context.logger.success(`${env.subdomain}.${domain} added to ${env.name} successfully!`)
            )
        } else {
            for (const env of environmentsForSubzones) {
                await manualZoneSetup({
                    context,
                    env,
                    domain: `${env.subdomain}.${domain} `
                })
            }
        }

    }
}