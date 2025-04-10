import {dirname} from "node:path"
import { ZodError, type z } from "zod";
import { CLIError, PanfactumZodError } from "../error/error";
import { fileExists } from "../fs/fileExists";
import { execute } from "../subprocess/execute";
import type { PanfactumContext } from "@/context/context";

export const sopsDecrypt = async <T extends z.ZodType<object>>({
    filePath,
    context,
    validationSchema
  }: {
    filePath: string;
    context: PanfactumContext;
    validationSchema: T;
  }) => {
  

    if(await fileExists(filePath)){
        const {stdout} = await execute({
            command: [
                "sops",
                "-d",
                "--output-type",
                "json",
                filePath
            ],
            context,
            workingDirectory: dirname(filePath)
        })
        try {
          return validationSchema.parse(JSON.parse(stdout)) as z.infer<T>
        } catch (e) {
          if(e instanceof ZodError){
            throw new PanfactumZodError("Decrypted sops data did not match expected schema", filePath, e)
          } else {
            throw new CLIError("Error parsing decrypted sops data", e)
          }
        }

    } else {
      throw new CLIError(`Cannot decrypt non-existant file at ${filePath}.`)
    }
  };
  