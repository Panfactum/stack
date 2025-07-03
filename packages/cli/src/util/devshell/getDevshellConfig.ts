// This file loads and validates Panfactum devshell configuration
// It merges devshell and user config files, validates them, and resolves directory paths

import { join, resolve } from "node:path";
import yaml from "yaml";
import { z } from "zod";
import { CLIError, PanfactumZodError } from '@/util/error/error';
import { DEVSHELL_CONFIG_FILE, DEVSHELL_USER_CONFIG_FILE } from "./constants";
import { getRoot } from "./getRoot";
import { PANFACTUM_DEVSHELL_SCHEMA } from "./schemas";

/**
 * Devshell configuration variables with resolved paths
 * 
 * @remarks
 * Extends the base schema with additional computed properties:
 * - iac_relative_dir: Original relative path of iac_dir before resolution
 * - repo_root: Absolute path to the repository root
 */
type DevshellConfig = z.infer<typeof PANFACTUM_DEVSHELL_SCHEMA> & {
  /** Original relative path of iac_dir before being resolved to absolute path */
  iac_relative_dir?: string;
  /** Absolute path to the repository root */
  repo_root: string;
};

/**
 * Loads and processes devshell configuration variables
 * 
 * @remarks
 * This function performs several important operations:
 * 1. Locates the repository root from the given directory
 * 2. Reads and parses the main panfactum.yaml configuration file
 * 3. Optionally merges user-specific configuration overrides
 * 4. Validates the configuration against the Panfactum devshell schema
 * 5. Resolves all directory paths to absolute paths
 * 6. Adds computed properties like repo_root and iac_relative_dir
 * 
 * The function supports a two-tier configuration system where user-specific
 * settings in panfactum.user.yaml can override repository defaults.
 * 
 * @param cwd - Current working directory to start searching for repo root
 * @returns Validated and processed devshell configuration variables
 * 
 * @example
 * ```typescript
 * const devshellConfig = await getDevshellConfig(process.cwd());
 * console.log(`Repository root: ${devshellConfig.repo_root}`);
 * console.log(`IaC directory: ${devshellConfig.iac_dir}`);
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when configuration files are missing or cannot be read
 * 
 * @throws {@link CLIError}
 * Throws when YAML syntax is invalid in configuration files
 * 
 * @throws {@link PanfactumZodError}
 * Throws when configuration doesn't match the required schema
 * 
 * @see {@link PANFACTUM_DEVSHELL_SCHEMA} - Schema definition for validation
 * @see {@link getRoot} - For finding the repository root
 */
export const getDevshellConfig = async (cwd: string): Promise<DevshellConfig> => {
  const repoRootPath = await getRoot(cwd);

  //####################################################################
  // Step 2: Read in the panfactum.yaml
  //####################################################################
  const configFile = join(repoRootPath, DEVSHELL_CONFIG_FILE);
  if (!(await Bun.file(configFile).exists())) {
    throw new CLIError(`Devshell configuration file does not exist at ${configFile}`);
  }

  const userConfigFile = join(repoRootPath, DEVSHELL_USER_CONFIG_FILE);

  const fileContent = await Bun.file(configFile).text()
    .catch((error: unknown) => {
      throw new CLIError(`Failed to read devshell configuration file at ${configFile}`, error);
    });

  let values: unknown;
  try {
    values = yaml.parse(fileContent);
  } catch (error) {
    throw new CLIError(`Invalid YAML syntax in devshell configuration file at ${configFile}`, error);
  }

  if ((await Bun.file(userConfigFile).exists())) {
    const userFileContent = await Bun.file(userConfigFile).text()
      .catch((error: unknown) => {
        throw new CLIError(`Failed to read user configuration file at ${userConfigFile}`, error);
      });

    let userValues: unknown;
    try {
      userValues = yaml.parse(userFileContent);
    } catch (error) {
      throw new CLIError(`Invalid YAML syntax in user configuration file at ${userConfigFile}`, error);
    }

    // Ensure both values are objects before spreading
    if (typeof values === 'object' && values !== null && typeof userValues === 'object' && userValues !== null) {
      values = { ...values, ...userValues };
    }
  }

  //####################################################################
  // Step 3: Validate required variables & set defaults
  //####################################################################
  const parseResult = PANFACTUM_DEVSHELL_SCHEMA.safeParse(values);
  if (!parseResult.success) {
    throw new PanfactumZodError(
      `Invalid configuration in devshell config file`,
      configFile,
      parseResult.error
    );
  }

  const validatedValues: DevshellConfig = { ...parseResult.data, repo_root: repoRootPath };

  //####################################################################
  // Step 4: Save the relative IaC dir (needed for panfactum.hcl)
  //####################################################################
  validatedValues["iac_relative_dir"] = validatedValues["iac_dir"]

  //####################################################################
  // Step 5: Resolve directories
  //####################################################################
  const dirKeys = [
    "environments_dir",
    "iac_dir",
    "aws_dir",
    "kube_dir",
    "ssh_dir",
    "buildkit_dir",
    "nats_dir",
  ] as const;
  for (const key of dirKeys) {
    validatedValues[key] = resolve(repoRootPath, validatedValues[key]);
  }

  return validatedValues;
};