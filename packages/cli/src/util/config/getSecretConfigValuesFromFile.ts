import { PANFACTUM_CONFIG_SCHEMA, type TGConfigFile } from "./schemas";
import { sopsDecrypt } from "../sops/sopsDecrypt";
import type { PanfactumContext } from "@/util/context/context";

export async function getSecretConfigValuesFromFile(input: {
    context: PanfactumContext;
    filePath: string;
}): Promise<TGConfigFile | null> {
    return sopsDecrypt({
        ...input,
        validationSchema: PANFACTUM_CONFIG_SCHEMA,
    });
}
