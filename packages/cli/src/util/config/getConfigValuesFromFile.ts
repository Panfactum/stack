
import { join } from "node:path"
import { getEnvironments } from "./getEnvironments";
import { getRegions } from "./getRegions";
import { PANFACTUM_CONFIG_SCHEMA, type TGConfigFile } from "./schemas";
import { sopsDecrypt } from "../sops/sopsDecrypt";
import { readYAMLFile } from "../yaml/readYAMLFile";
import type { PanfactumContext } from "@/util/context/context";

type BaseConfigInput = {
    secret?: boolean;
    context: PanfactumContext;
};

type FilepathConfigInput = BaseConfigInput & {
    filePath: string;
};

type EnvironmentConfigInput = BaseConfigInput & {
    environment: string;
};

type RegionConfigInput = EnvironmentConfigInput & {
    region: string;
};

type ModuleConfigInput = RegionConfigInput & {
    module: string;
};

type ConfigInput =
    | EnvironmentConfigInput
    | RegionConfigInput
    | ModuleConfigInput
    | FilepathConfigInput;


export async function getConfigValuesFromFile(input: ConfigInput): Promise<TGConfigFile | null> {
    const { secret, context } = input;

    const suffix = secret ? ".secret.yaml" : ".yaml"
    let filePath;
    if ("filePath" in input) {
        filePath = input.filePath;
    } else if ("module" in input) {
        const { environment, region, module } = input;
        const envMeta = (await getEnvironments(context)).find(env => env.name === environment)
        if (!envMeta) {
            return null
        }
        const regionMeta = (await getRegions(context, envMeta.path)).find(r => r.name === region)
        if (!regionMeta) {
            return null
        }
        filePath = join(regionMeta.path, module, `module${suffix}`)
    } else if ("region" in input) {
        const { environment, region } = input;
        const envMeta = (await getEnvironments(context)).find(env => env.name === environment)
        if (!envMeta) {
            return null
        }
        const regionMeta = (await getRegions(context, envMeta.path)).find(r => r.name === region)
        if (!regionMeta) {
            return null
        }
        filePath = join(regionMeta.path, `region${suffix}`)
    } else if ("environment" in input) {
        const { environment } = input;
        const envMeta = (await getEnvironments(context)).find(env => env.name === environment)
        if (!envMeta) {
            return null
        }
        filePath = join(envMeta.path, `environment${suffix}`)
    } else {
        filePath = join(context.repoVariables.environments_dir, `global${suffix}`)
    }

    return secret ?
        sopsDecrypt({
            context,
            filePath,
            validationSchema: PANFACTUM_CONFIG_SCHEMA
        }) :
        readYAMLFile({
            context,
            filePath,
            validationSchema: PANFACTUM_CONFIG_SCHEMA,
        });
}
