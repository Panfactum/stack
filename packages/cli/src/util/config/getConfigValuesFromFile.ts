import { PANFACTUM_CONFIG_SCHEMA, type TGConfigFile } from "./schemas";
import { readYAMLFile } from "../yaml/readYAMLFile";
import type { PanfactumContext } from "@/context/context";

export async function getConfigValuesFromFile(input: {context: PanfactumContext, filePath: string}): Promise<TGConfigFile | null>{
    return readYAMLFile({
        ...input,
        validationSchema: PANFACTUM_CONFIG_SCHEMA
    })
  }