import { stringify } from "yaml";
import { getConfigValuesFromFile } from "./getConfigValuesFromFile";
import { CLIError } from "../error/error";
import { writeFile } from "../fs/writeFile";
import { sopsWrite } from "../sops/sopsWrite";
import type { TGConfigFile } from "./schemas";
import type { PanfactumContext } from "@/util/context/context";

interface UpsertConfigValuesInput {
    context: PanfactumContext;
    values: TGConfigFile
    filePath: string
    secret?: boolean; // If true, the file will be sops-encrypted
}

export async function upsertConfigValues(input: UpsertConfigValuesInput) {
    const { values, filePath, context, secret } = input;

    const existingValues = await getConfigValuesFromFile(input)
    const yamlOpts = {
        doubleQuotedAsJSON: true,
    }

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
                contents: stringify(newValues, yamlOpts),
                context,
                overwrite: true
            })
        }
    } catch (e) {
        throw new CLIError(`Failed to write new config values to ${filePath}`, e)
    }

}