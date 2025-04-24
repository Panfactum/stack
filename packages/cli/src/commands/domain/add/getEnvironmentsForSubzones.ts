import type { PanfactumContext } from "@/context/context";
import { applyColors } from "@/util/colors/applyColors";
import { getEnvironments, type EnvironmentMeta } from "@/util/config/getEnvironments";
import { DOMAIN, SUBDOMAIN } from "@/util/config/schemas";
import { upsertConfigValues } from "@/util/config/upsertConfigValues";
import { MANAGEMENT_ENVIRONMENT } from "@/util/terragrunt/constants";
import { checkbox, input } from "@inquirer/prompts";
import {join} from "node:path"

export async function getEnvironmentsForSubzones(inputs: {
    context: PanfactumContext,
    ancestorDomain: string;
    possibleEnvironments: EnvironmentMeta[]
}){
    const {context, possibleEnvironments, ancestorDomain} = inputs;

    const environmentsForSubzones = await checkbox({
        message: applyColors('Select environments for subzones:', {style: "question"}),
        theme: {
            helpMode: "never"
        },
        choices: possibleEnvironments
            .map(env => ({
                name: applyColors(`${env.name} ${env.subdomain ? env.subdomain : "TBD"}.${ancestorDomain}`, {
                    highlights: [{phrase: `${env.subdomain ? env.subdomain : "TBD"}.${ancestorDomain}`, style: "subtle"}]
                }),
                value: env
            })),
        
    })


    for(const env of environmentsForSubzones){
        if(!env.subdomain){
            context.logger.log(
                applyColors(
                    `Environment ${env.name} does not have a subdomain set. You need to choose one to proceed.\n\n` +
                    `This can be any single subdomain segment: prod, stage, dev, etc.`,
                    {highlights: [env.name]}
                ),
                {trailingNewlines: 1, leadingNewlines: 1}
            )
            const envSubdomain = await input({
                message: applyColors("Subdomain:", {style: "question"}),
                required: true,
                default: env.name,
                validate: (val) => {
                    const { error } = SUBDOMAIN.safeParse(val)
                    if (error) {
                        return applyColors(error.issues[0]?.message ?? "Invalid subdomain", { style: "error" })
                    }
                    const segments = val.split(".")
                    if(segments.length !== 1){
                        return applyColors(`Subdomain should only have one segment. Given ${segments.length}: ${segments.join(" ")}`, {style: "error"})
                    }

                    const duplicateSubdomainEnv = possibleEnvironments.find(env => env.subdomain === val)
                    if( duplicateSubdomainEnv){
                        return applyColors(`Subdomain must be unique per environment. ${val} is already taken by the ${env.name} environment.`, {style: "error"})
                    }
                    return true
                }
            })
            env.subdomain = envSubdomain
            await upsertConfigValues({
                context,
                values: {
                    environment_subdomain: envSubdomain
                },
                filePath: join(env.path, "environment.yaml")
            })
        }
    }

    return environmentsForSubzones
}