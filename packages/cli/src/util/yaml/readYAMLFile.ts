import { parse } from "yaml";
import { z } from "zod";
import { CLIError, PanfactumZodError } from "@/util/error/error";
import { fileExists } from "@/util/fs/fileExists";
import type { PanfactumContext } from "@/util/context/context";

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

    // Read file content
    context.logger.debug(`Reading yaml file`, { filePath });
    const fileContent = await Bun.file(filePath).text()
        .catch((error: unknown) => {
            throw new CLIError(`Unable to read file at ${filePath}`, error);
        });
    context.logger.debug(`Finished reading yaml file`, { filePath });

    // Check if file is empty
    if (!fileContent || fileContent.trim().length === 0) {
        if (throwOnEmpty) {
            throw new CLIError(`File is empty at ${filePath}`);
        }
        return null;
    }

    // Parse YAML
    let parsedYaml: unknown;
    try {
        parsedYaml = parse(fileContent);
    } catch (error) {
        throw new CLIError(`Invalid YAML syntax in file at ${filePath}`, error);
    }

    // Check if parsed content is null/undefined
    if (parsedYaml === null || parsedYaml === undefined) {
        if (throwOnEmpty) {
            throw new CLIError(`File is empty at ${filePath}`);
        }
        return null;
    }

    // Validate with schema
    context.logger.debug(`Validating`, { filePath });
    const parseResult = validationSchema.safeParse(parsedYaml);
    if (!parseResult.success) {
        throw new PanfactumZodError("Invalid values in yaml file", filePath, parseResult.error);
    }

    return parseResult.data as z.infer<T>;
};
