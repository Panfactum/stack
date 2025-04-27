import { parse } from "yaml";
import { z, ZodError } from "zod";
import { CLIError, PanfactumZodError } from "../error/error";
import { fileExists } from "../fs/fileExists";
import type { PanfactumContext } from "@/context/context";

export const readYAMLFile = async <T extends z.ZodType<object>>(inputs: {
    context: PanfactumContext;
    filePath: string;
    validationSchema: T;
    throwOnMissing?: boolean;
    throwOnEmpty?: boolean;
}) => {
    const { filePath, throwOnMissing, throwOnEmpty, validationSchema, context } = inputs;

    if (!(await fileExists(filePath))) {
        if (throwOnMissing) {
            throw new CLIError(`File does not exist at ${filePath}`);
        } else {
            return null;
        }
    }

    try {
        context.logger.debug(`Reading yaml file`, { filePath });
        const fileContent = await Bun.file(filePath).text();
        context.logger.debug(`Finised reading yaml file`, { filePath });
        context.logger.debug(`Validating`, { filePath })
        const parsedYaml = parse(fileContent);
        if (parsedYaml) {
            return validationSchema.parse(parsedYaml) as z.infer<T>;
        } else if (throwOnEmpty) {
            throw new CLIError("File is empty")
        }
    } catch (e) {
        if (e instanceof ZodError) {
            throw new PanfactumZodError("Invalid values in yaml file", filePath, e);
        } else {
            throw new CLIError(`Unable to parse file at ${filePath}`, e);
        }
    }
    return null;
};
