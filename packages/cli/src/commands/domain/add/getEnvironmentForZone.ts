import type { PanfactumContext } from "@/context/context";
import { applyColors } from "@/util/colors/applyColors";
import { getEnvironments } from "@/util/config/getEnvironments";
import { CLIError } from "@/util/error/error";
import { MANAGEMENT_ENVIRONMENT } from "@/util/terragrunt/constants";
import { confirm, input, search } from "@inquirer/prompts";

export async function getEnvironmentForZone(inputs: {
    context: PanfactumContext,
    domain: string,
    shouldBeProduction?: boolean
}) {
    const { context, domain, shouldBeProduction } = inputs;

    const environments = await getEnvironments(context)
    const possibleEnvironment = environments.filter(({ name }) => name !== MANAGEMENT_ENVIRONMENT)

    if (possibleEnvironment.length === 0) {
        if (environments.length === 0) {
            throw new CLIError('Cannot add a domain until you have installed an environment to host the domain. Run `pf env install` to create an environment.')
        } else {
            throw new CLIError('You only have a management environment which cannot be used to host domains. Run `pf env install` to create an additional environment.')
        }
    }
    if (possibleEnvironment.length === 1) {
        const environment = possibleEnvironment[0]?.name!

        context.logger.log(applyColors(`You only have one environment: ${environment}.`, { highlights: [environment] }), { trailingNewlines: 1, leadingNewlines: 1 })

        const confirmEnvironment = await confirm(
            {
                message: applyColors(`Would you like to host the DNS zone for ${domain} in ${environment}?`, { style: "question", highlights: [domain, environment] }),
                default: true
            }
        )
        if (!confirmEnvironment) {
            throw new CLIError(`Declined to host ${domain} in ${environment}. Create a new environment to host the domain by running \`pf env install\``)
        } else if (!environment.includes("prod") && shouldBeProduction) {
            await confirmIfNotProd(context, environment, domain)
        }
        return possibleEnvironment[0]!
    } else {
        context.logger.log(
            applyColors(`In which environment would you like to host the DNS zone for ${domain}?`, { highlights: [domain] }),
            { trailingNewlines: 1, leadingNewlines: 1 }
        )

        const chosenEnvironment = await search<{ name: string, path: string }>({
            message: applyColors("Environment:", { style: "question" }),
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
    context.logger.log(
        applyColors(
            `WARNING: ${environment} does not look like a production environment.\n` +
            `We recommend hosting this DNS zone in a production environment for security and to allow production workloads\n` +
            `to utilize the ${domain} domain. This is NOT easy to change in the future.`,
            { style: "warning", highlights: [environment, domain] }
        ), { trailingNewlines: 1, leadingNewlines: 1 }
    )
    await input(
        {
            message: applyColors(`Type ${environment} to confirm:`, { style: "question", highlights: [environment] }),
            required: true,
            validate: (val) => {
                return val === environment ? true : applyColors(`You must type '${environment}' to continue.`, { style: 'error' })
            }
        }
    )
}