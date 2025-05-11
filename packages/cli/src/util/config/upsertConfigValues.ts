import { join } from "node:path"
import { stringify } from "yaml";
import { getConfigValuesFromFile } from "./getConfigValuesFromFile";
import { getEnvironments } from "./getEnvironments";
import { getRegions } from "./getRegions";
import { CLIError } from "../error/error";
import { writeFile } from "../fs/writeFile";
import { sopsWrite } from "../sops/sopsWrite";
import type { TGConfigFile } from "./schemas";
import type { PanfactumContext } from "@/util/context/context";

type BaseUpsertInput = {
    secret?: boolean;
    context: PanfactumContext;
    values: TGConfigFile;
};

type FilepathUpsertInput = BaseUpsertInput & {
    filePath: string;
};

type EnvironmentUpsertInput = BaseUpsertInput & {
    environment: string;
};

type RegionUpsertInput = EnvironmentUpsertInput & {
    region: string;
};

type ModuleUpsertInput = RegionUpsertInput & {
    module: string;
};

type UpsertInput =
    | EnvironmentUpsertInput
    | RegionUpsertInput
    | ModuleUpsertInput
    | FilepathUpsertInput;

export async function upsertConfigValues(input: UpsertInput) {
    const { values, context, secret } = input;

    // Determine the file name to write to based on the
    // the inputs; note that this is a bit complicated
    // because the environment, region, and module names
    // don't necessarily have to match their directory names
    const suffix = secret ? ".secret.yaml" : ".yaml"
    let filePath;
    if ("filePath" in input) {
        filePath = input.filePath;
    } else if ("module" in input) {
        const { environment, region, module } = input;
        const fileName = `module${suffix}`
        const envMeta = (await getEnvironments(context)).find(env => env.name === environment)
        if (!envMeta) {
            filePath = join(context.repoVariables.environments_dir, environment, region, module, fileName)
        } else {
            const regionMeta = (await getRegions(context, envMeta.path)).find(r => r.name === region)
            if (!regionMeta) {
                filePath = join(envMeta.path, region, module, fileName)
            } else {
                filePath = join(regionMeta.path, module, fileName)
            }
        }
    } else if ("region" in input) {
        const { environment, region } = input;
        const fileName = `region${suffix}`
        const envMeta = (await getEnvironments(context)).find(env => env.name === environment)
        if (!envMeta) {
            filePath = join(context.repoVariables.environments_dir, environment, region, fileName)
        } else {
            const regionMeta = (await getRegions(context, envMeta.path)).find(r => r.name === region)
            if (!regionMeta) {
                filePath = join(envMeta.path, region, fileName)
            } else {
                filePath = join(regionMeta.path, fileName)
            }
        }
    } else if ("environment" in input) {
        const { environment } = input;
        const fileName = `environment${suffix}`
        const envMeta = (await getEnvironments(context)).find(env => env.name === environment)
        if (!envMeta) {
            filePath = join(context.repoVariables.environments_dir, environment, fileName)
        } else {
            filePath = join(envMeta.path, fileName)
        }
    } else {
        filePath = join(context.repoVariables.environments_dir, `global${suffix}`)
    }

    // Get the existing values
    const existingValues = await getConfigValuesFromFile(input)


    // Merge the existing values with the new values
    // and write the results
    try {
        const newValues = existingValues ? {
            ...existingValues,
            ...values,
            extra_inputs: {
                ...existingValues.extra_inputs,
                ...values.extra_inputs
            },
            extra_tags: {
                ...existingValues.extra_tags,
                ...values.extra_tags
            },
            domains: {
                ...existingValues.domains,
                ...values.domains
            }
        } : values;

        if (secret) {
            await sopsWrite({
                filePath,
                values: newValues,
                context,
                overwrite: true
            })
        } else {
            await writeFile({
                filePath: filePath,
                contents: stringify(newValues, {
                    doubleQuotedAsJSON: true,
                }),
                context,
                overwrite: true
            })
        }
    } catch (e) {
        throw new CLIError(`Failed to write new config values to ${filePath}`, e)
    }

}