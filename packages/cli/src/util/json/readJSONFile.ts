// Utility for reading and validating JSON files with Zod schemas
// Similar to readYAMLFile but for JSON format
import { z, ZodError } from "zod";
import { CLIError, PanfactumZodError } from "@/util/error/error";
import { fileExists } from "@/util/fs/fileExists";
import type { PanfactumContext } from "@/util/context/context";

export const readJSONFile = async <T extends z.ZodType<object>>(inputs: {
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
        context.logger.debug(`Reading JSON file`, { filePath });
        const fileContent = await Bun.file(filePath).text();
        context.logger.debug(`Finished reading JSON file`, { filePath });
        context.logger.debug(`Validating JSON`, { filePath });
        const parsedJson = JSON.parse(fileContent);
        if (parsedJson) {
            return validationSchema.parse(parsedJson) as z.infer<T>;
        } else if (throwOnEmpty) {
            throw new CLIError("File is empty");
        }
    } catch (e) {
        if (e instanceof ZodError) {
            throw new PanfactumZodError("Invalid values in JSON file", filePath, e);
        } else {
            throw new CLIError(`Unable to parse JSON file at ${filePath}`, { cause: e });
        }
    }
    return null;
};