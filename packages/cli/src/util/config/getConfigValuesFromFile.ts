import { PANFACTUM_CONFIG_SCHEMA, type TGConfigFile } from "./schemas";
import { sopsDecrypt } from "../sops/sopsDecrypt";
import { readYAMLFile } from "../yaml/readYAMLFile";
import type { PanfactumContext } from "@/util/context/context";

export async function getConfigValuesFromFile(input: {
    context: PanfactumContext;
    filePath: string;
    secret?: boolean;
}): Promise<TGConfigFile | null> {
    const { secret, ...rest } = input;
    return secret ?
        sopsDecrypt({
            ...rest,
            validationSchema: PANFACTUM_CONFIG_SCHEMA
        }) :
        readYAMLFile({
            ...rest,
            validationSchema: PANFACTUM_CONFIG_SCHEMA,
        });
}
