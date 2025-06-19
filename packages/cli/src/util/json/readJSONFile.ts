// Utility for reading and validating JSON files with Zod schemas
// Similar to readYAMLFile but for JSON format
import { z } from "zod";
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

    // Read file content
    context.logger.debug(`Reading JSON file`, { filePath });
    const fileContent = await Bun.file(filePath).text()
        .catch((error: unknown) => {
            throw new CLIError(`Unable to read file at ${filePath}`, error);
        });
    context.logger.debug(`Finished reading JSON file`, { filePath });

    // Check if file is empty
    if (!fileContent || fileContent.trim().length === 0) {
        if (throwOnEmpty) {
            throw new CLIError(`File is empty at ${filePath}`);
        }
        return null;
    }

    // Parse JSON
    let parsedJson: unknown;
    try {
        parsedJson = JSON.parse(fileContent);
    } catch (error) {
        throw new CLIError(`Invalid JSON syntax in file at ${filePath}`, error);
    }

    // Validate with schema
    context.logger.debug(`Validating JSON`, { filePath });
    const parseResult = validationSchema.safeParse(parsedJson);
    if (!parseResult.success) {
        throw new PanfactumZodError("Invalid values in JSON file", filePath, parseResult.error);
    }

    return parseResult.data as z.infer<T>;
};