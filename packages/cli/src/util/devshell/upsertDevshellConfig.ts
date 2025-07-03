// This file provides functionality to update Panfactum devshell configuration files
// It supports both devshell-wide and user-specific configuration updates

import { join } from "node:path";
import { stringify, parse } from "yaml";
import { type z } from "zod";
import { CLIError, PanfactumZodError } from "@/util/error/error";
import { writeFile } from "@/util/fs/writeFile";
import { DEVSHELL_CONFIG_FILE, DEVSHELL_USER_CONFIG_FILE } from "./constants";
import { PANFACTUM_DEVSHELL_SCHEMA } from "./schemas";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Schema for partial updates to Panfactum devshell configuration
 * 
 * @remarks
 * All fields are optional, allowing updates to specific configuration
 * values without requiring the entire configuration object.
 */
const OPTIONAL_PANFACTUM_DEVSHELL_SCHEMA = PANFACTUM_DEVSHELL_SCHEMA.partial();

/**
 * Input parameters for updating devshell configuration variables
 */
interface IUpsertDevshellConfigInput {
    /** Panfactum context containing current configuration */
    context: PanfactumContext;
    /** Configuration values to update */
    values: z.infer<typeof OPTIONAL_PANFACTUM_DEVSHELL_SCHEMA>;
    /** Whether to update user-specific config (true) or devshell config (false) */
    user?: boolean;
}

/**
 * Updates devshell configuration variables in YAML files
 * 
 * @remarks
 * This function performs a merge update of configuration values:
 * 1. Validates the provided values against the schema
 * 2. Reads the existing configuration file (if it exists)
 * 3. Merges new values with existing ones (new values override)
 * 4. Writes the updated configuration back to the file
 * 5. Updates the in-memory context with the new values
 * 
 * The function can update either the main devshell configuration
 * (panfactum.yaml) or user-specific configuration (panfactum.user.yaml)
 * based on the `user` parameter.
 * 
 * @param input - Configuration update parameters
 * 
 * @example
 * ```typescript
 * await upsertDevshellConfig({
 *   context,
 *   values: {
 *     repo_name: "my-new-repo",
 *     environments_dir: "custom-envs"
 *   },
 *   user: false  // Update devshell config
 * });
 * ```
 * 
 * @throws {@link PanfactumZodError}
 * Throws when provided values don't match the schema
 * 
 * @throws {@link CLIError}
 * Throws when unable to read or write configuration files
 * 
 * @throws {@link CLIError}
 * Throws when existing configuration has invalid YAML syntax
 * 
 * @see {@link PANFACTUM_DEVSHELL_SCHEMA} - Schema for configuration validation
 * @see {@link writeFile} - For atomic file writing
 */
export async function upsertDevshellConfig(input: IUpsertDevshellConfigInput): Promise<void> {
    const { values, context, user } = input;

    /////////////////////////////////////////////
    // Update panfactum.yaml
    /////////////////////////////////////////////
    // YAML serialization options for consistent output
    const yamlOpts = {
        doubleQuotedAsJSON: true,
    }
    const configFilePath = join(context.devshellConfig.repo_root, user ? DEVSHELL_USER_CONFIG_FILE : DEVSHELL_CONFIG_FILE)

    const explainer = "# These are the standard devshell config variables required by\n" +
        "# https://panfactum.com/docs/reference/devshell-config\n\n"

    // Validate values first
    const parseResult = OPTIONAL_PANFACTUM_DEVSHELL_SCHEMA.safeParse(values);
    if (!parseResult.success) {
        throw new PanfactumZodError("Failed to validate devshell config", "upsertDevshellConfig", parseResult.error);
    }
    const validatedValues = parseResult.data;

    if (await Bun.file(configFilePath).exists()) {
        const fileContent = await Bun.file(configFilePath).text()
            .catch((error: unknown) => {
                throw new CLIError(`Failed to read config file at ${configFilePath}`, error);
            });

        let existingValues: unknown;
        try {
            existingValues = parse(fileContent);
        } catch (error) {
            throw new CLIError(`Invalid YAML syntax in config file at ${configFilePath}`, error);
        }

        // Ensure existingValues is an object before spreading
        const mergedValues = (typeof existingValues === 'object' && existingValues !== null && !Array.isArray(existingValues))
            ? { ...existingValues, ...validatedValues }
            : validatedValues;

        await writeFile({
            filePath: configFilePath,
            contents: explainer + stringify(mergedValues, yamlOpts),
            context,
            overwrite: true
        }).catch((error: unknown) => {
            throw new CLIError(`Failed to write devshell config to ${configFilePath}`, error);
        });
    } else {
        await writeFile({
            filePath: configFilePath,
            contents: explainer + stringify(validatedValues, yamlOpts),
            context,
            overwrite: true
        }).catch((error: unknown) => {
            throw new CLIError(`Failed to write devshell config to ${configFilePath}`, error);
        });
    }

    /////////////////////////////////////////////
    // Update the context
    /////////////////////////////////////////////
    // Update in-memory context to reflect the changes
    Object.entries(values).forEach(([key, val]) => {
        context.devshellConfig[key as keyof z.infer<typeof PANFACTUM_DEVSHELL_SCHEMA>] = val
    })
}