import { type IEnvironmentMeta } from "@/util/config/getEnvironments";
import { SUBDOMAIN } from "@/util/config/schemas";
import { upsertConfigValues } from "@/util/config/upsertConfigValues";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Interface for getEnvironmentsForSubzones function inputs
 */
interface IGetEnvironmentsForSubzonesInputs {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** Ancestor domain name for subzone creation */
  ancestorDomain: string;
  /** Available environments for subzone selection */
  possibleEnvironments: IEnvironmentMeta[];
}

export async function getEnvironmentsForSubzones(inputs: IGetEnvironmentsForSubzonesInputs): Promise<IEnvironmentMeta[]> {
    const { context, possibleEnvironments, ancestorDomain } = inputs;

    const environmentsForSubzones = await context.logger.checkbox({
        message: 'Select environments for subzones:',
        choices: possibleEnvironments
            .map(env => ({
                name: context.logger.applyColors(`${env.name} ${env.subdomain ? env.subdomain : "TBD"}.${ancestorDomain}`, {
                    lowlights: [`${env.subdomain ? env.subdomain : "TBD"}.${ancestorDomain}`]
                }),
                value: env
            })),

    })

    for (const env of environmentsForSubzones) {
        if (!env.subdomain) {
            const envSubdomain = await context.logger.input({
                explainer: `
                    Environment ${env.name} does not have a subdomain set. You need to choose one to proceed.
                    
                    This can be any single subdomain segment: prod, stage, dev, etc.
                `,
                message: "Subdomain:",
                required: true,
                default: env.name,
                validate: (val) => {
                    const { error } = SUBDOMAIN.safeParse(val)
                    if (error) {
                        return error.issues[0]?.message ?? "Invalid subdomain"
                    }
                    const segments = val.split(".")
                    if (segments.length !== 1) {
                        return `Subdomain should only have one segment. Given ${segments.length}: ${segments.join(" ")}`
                    }

                    const duplicateSubdomainEnv = possibleEnvironments.find(env => env.subdomain === val)
                    if (duplicateSubdomainEnv) {
                        return `Subdomain must be unique per environment. ${val} is already taken by the ${env.name} environment.`
                    }
                    return true
                }
            })
            env.subdomain = envSubdomain
            await upsertConfigValues({
                context,
                environment: env.name,
                values: {
                    environment_subdomain: envSubdomain
                }
            })
        }
    }

    return environmentsForSubzones
}