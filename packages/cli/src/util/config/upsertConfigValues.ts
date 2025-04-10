import {stringify} from "yaml";
import { getConfigValuesFromFile } from "./getConfigValuesFromFile";
import { CLIError } from "../error/error";
import type { TGConfigFile } from "./schemas";

interface UpsertConfigValuesInput {
    values: TGConfigFile
    filePath: string
}

export async function upsertConfigValues(input: UpsertConfigValuesInput){
    const {values, filePath} = input;

    const existingValues = await getConfigValuesFromFile(filePath)
    const yamlOpts = {
        doubleQuotedAsJSON: true,
      }

    try {
        if(existingValues){
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
                 }
            }, yamlOpts))
        }else{
            await Bun.write(filePath, stringify(values, yamlOpts))
        }
    } catch (e) {
        throw new CLIError(`Failed to write new config values to ${filePath}`, e)
    }

}