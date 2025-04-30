import { getEnvironments, type EnvironmentMeta } from "@/util/config/getEnvironments";
import { CLIError } from "@/util/error/error";
import { MANAGEMENT_ENVIRONMENT } from "@/util/terragrunt/constants";
import type { PanfactumContext } from "@/util/context/context";

export async function getEnvironmentForZone(inputs: {
    context: PanfactumContext,
    domain: string,
    shouldBeProduction?: boolean
    environmentMeta?: EnvironmentMeta
}) {
    const { context, domain, shouldBeProduction, environmentMeta } = inputs;

    if (environmentMeta) {
        if (!environmentMeta.name.includes("prod") && shouldBeProduction) {
            await confirmIfNotProd(context, environmentMeta.name, domain)
        }
        return environmentMeta
    }

    const environments = await getEnvironments(context)
    const possibleEnvironment = environments.filter(({ name }) => name !== MANAGEMENT_ENVIRONMENT)

    if (possibleEnvironment.length === 0) {
        if (environments.length === 0) {
            throw new CLIError('Cannot add a domain until you have installed an environment to host the domain. Run `pf env add` to create an environment.')
        } else {
            throw new CLIError('You only have a management environment which cannot be used to host domains. Run `pf env add` to create an additional environment.')
        }
    }
    if (possibleEnvironment.length === 1) {
        const environment = possibleEnvironment[0]?.name!

        const confirmEnvironment = await context.logger.confirm({
            explainer: `You only have one environment: ${environment}.`,
            message: `Would you like to host the DNS zone for ${domain} in ${environment}?`,
            default: true
        })
        if (!confirmEnvironment) {
            throw new CLIError(`Declined to host ${domain} in ${environment}. Create a new environment to host the domain by running \`pf env add\``)
        } else if (!environment.includes("prod") && shouldBeProduction) {
            await confirmIfNotProd(context, environment, domain)
        }
        return possibleEnvironment[0]!
    } else {

        const chosenEnvironment = await context.logger.search<{ name: string, path: string }>({
            explainer: `In which environment would you like to host the DNS zone for ${domain}?`,
            message: "Environment:",
            source: (term) => {
                const choices = possibleEnvironment
                    .map(({ name, path }) => ({ name, value: { name, path } }))
                    .sort((a, b) => {
                        const aHasProd = a.name.includes('prod');
                        const bHasProd = b.name.includes('prod');
                        if (aHasProd && !bHasProd) return -1;
                        if (!aHasProd && bHasProd) return 1;
                        return 0;
                    });
                return term ? choices.filter(({ name }) => name.includes(term)) : choices
            }
        })

        const chosenEnvironmentName = chosenEnvironment.name
        if (!chosenEnvironmentName.includes("prod") && shouldBeProduction) {
            await confirmIfNotProd(context, chosenEnvironmentName, domain)
        }
        return chosenEnvironment;
    }
}

async function confirmIfNotProd(context: PanfactumContext, environment: string, domain: string) {
    context.logger.warn(`
        WARNING: ${environment} does not look like a production environment.
        We recommend hosting this DNS zone in a production environment for security and to allow production workloads
        to utilize the ${domain} domain. This is NOT easy to change in the future.
    `)
    await context.logger.input(
        {
            message: `Type ${environment} to confirm:`,
            required: true,
            validate: (val) => {
                return val === environment ? true : `You must type '${environment}' to continue.`
            }
        }
    )
}