import { join } from "node:path";
import { stringify, parse } from "yaml";
import { type z } from "zod";
import { CLIError, PanfactumZodError } from "@/util/error/error";
import { writeFile } from "@/util/fs/writeFile";
import { REPO_CONFIG_FILE, REPO_USER_CONFIG_FILE } from "./constants";
import { PANFACTUM_YAML_SCHEMA } from "./schemas";
import type { PanfactumContext } from "@/util/context/context";

const OPTIONAL_PANFACTUM_YAML_SCHEMA = PANFACTUM_YAML_SCHEMA.partial();

interface UpsertRepoVariablesInput {
    context: PanfactumContext;
    values: z.infer<typeof OPTIONAL_PANFACTUM_YAML_SCHEMA>;
    user?: boolean;
}

export async function upsertRepoVariables(input: UpsertRepoVariablesInput) {
    const { values, context, user } = input;

    /////////////////////////////////////////////
    // Update panfactum.yaml
    /////////////////////////////////////////////
    const yamlOpts = {
        doubleQuotedAsJSON: true,
    }
    const configFilePath = join(context.repoVariables.repo_root, user ? REPO_USER_CONFIG_FILE : REPO_CONFIG_FILE)

    const explainer = "# These are the standard repo variables required by\n" +
        "# https://panfactum.com/docs/reference/repo-variables\n\n"

    // Validate values first
    const parseResult = OPTIONAL_PANFACTUM_YAML_SCHEMA.safeParse(values);
    if (!parseResult.success) {
        throw new PanfactumZodError("Failed to validate repo variables", "upsertRepoVariables", parseResult.error);
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
            throw new CLIError(`Failed to write repo variables to ${configFilePath}`, error);
        });
    } else {
        await writeFile({
            filePath: configFilePath,
            contents: explainer + stringify(validatedValues, yamlOpts),
            context,
            overwrite: true
        }).catch((error: unknown) => {
            throw new CLIError(`Failed to write repo variables to ${configFilePath}`, error);
        });
    }

    /////////////////////////////////////////////
    // Update the context
    /////////////////////////////////////////////
    Object.entries(values).forEach(([key, val]) => {
        context.repoVariables[key as keyof z.infer<typeof PANFACTUM_YAML_SCHEMA>] = val
    })
}