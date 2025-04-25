import { stringify } from "yaml";
import { getConfigValuesFromFile } from "./getConfigValuesFromFile";
import { CLIError } from "../error/error";
import { writeFile } from "../fs/writeFile";
import type { TGConfigFile } from "./schemas";
import type { PanfactumContext } from "@/context/context";

interface UpsertConfigValuesInput {
    context: PanfactumContext;
    values: TGConfigFile
    filePath: string
}

export async function upsertConfigValues(input: UpsertConfigValuesInput) {
    const { values, filePath, context } = input;

    const existingValues = await getConfigValuesFromFile(input)
    const yamlOpts = {
        doubleQuotedAsJSON: true,
    }

    try {
        if (existingValues) {
            await Bun.write(filePath, stringify({
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
            }, yamlOpts))
        } else {
            await writeFile({
                contents: stringify(values, yamlOpts),
                path: filePath,
                overwrite: true,
                context
            })
        }
    } catch (e) {
        throw new CLIError(`Failed to write new config values to ${filePath}`, e)
    }

}