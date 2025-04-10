import {parse} from "yaml"
import { ZodError } from "zod";
import { PANFACTUM_CONFIG_SCHEMA, type TGConfigFile } from "./schemas";
import { CLIError, PanfactumZodError } from "../error/error";
import { fileExists } from "../fs/fileExists";

export async function getConfigValuesFromFile(filePath: string): Promise<TGConfigFile | null>{

    if (! await fileExists(filePath)){
        return null
    }

    const fileContent = await Bun.file(filePath).text();
    
    // Skip if the file is empty or only contains comments
    const nonCommentLines = fileContent
      .split("\n")
      .filter((line) => !line.trim().startsWith("#") && line.trim() !== "");
    if (nonCommentLines.length === 0) {
      return null;
    }


    try {
        const parsedYaml = parse(fileContent);
        if (parsedYaml !== undefined) {
            return PANFACTUM_CONFIG_SCHEMA.parse(parsedYaml);
        }
    } catch (e) {
        if(e instanceof ZodError){
            throw new PanfactumZodError("Invalid values in config file", filePath, e)
        } else {
            throw new CLIError(`Unable to parse file at ${filePath}`, e)
        }
    }

    return null;
  }