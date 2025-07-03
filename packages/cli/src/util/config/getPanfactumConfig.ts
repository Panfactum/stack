// This file provides utilities for loading hierarchical Panfactum configuration
// It merges configuration from multiple levels (global, environment, region, module)

import { dirname, join } from "node:path";
import { z } from "zod";
import { CONFIG_FILE_PRECEDENCE } from "@/util/config/constants";
import { PANFACTUM_CONFIG_SCHEMA } from "@/util/config/schemas";
import { CLIError } from "@/util/error/error";
import { getVaultToken } from "@/util/vault/getVaultToken";
import { getConfigValuesFromFile } from "./getConfigValuesFromFile";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Base configuration values from files
 */
type InputValues = z.infer<typeof PANFACTUM_CONFIG_SCHEMA>;

/**
 * Extended configuration with computed directory values
 */
interface IOutputValues extends InputValues {
  /** The environment directory name (may differ from environment name) */
  environment_dir?: string;
  /** The region directory name (may differ from region name) */
  region_dir?: string;
  /** The module directory name (may differ from module name) */
  module_dir?: string;
}


/**
 * Input parameters for getting Panfactum configuration
 */
interface IGetPanfactumConfigInput {
  /** Panfactum context for configuration access */
  context: PanfactumContext;
  /** Directory to start searching from (defaults to current working directory) */
  directory?: string;
}

/**
 * Loads and merges Panfactum configuration from the hierarchy of config files
 * 
 * @remarks
 * This function implements Panfactum's hierarchical configuration system by:
 * 
 * 1. Starting from the given directory and walking up to the repo root
 * 2. Searching for all configuration files at each level
 * 3. Merging configurations with proper precedence (later overrides earlier)
 * 4. Computing default values based on directory structure
 * 5. Adding computed values like directory names
 * 6. Fetching Vault tokens if in a region context
 * 
 * The configuration hierarchy allows:
 * - Global defaults in `environments/global.yaml`
 * - Environment overrides in `environments/{env}/environment.yaml`
 * - Region overrides in `environments/{env}/{region}/region.yaml`
 * - Module overrides in `environments/{env}/{region}/{module}/module.yaml`
 * 
 * Special handling for:
 * - `extra_tags`, `extra_inputs`, and `domains` are merged (not replaced)
 * - AWS secondary accounts default to primary if not specified
 * - Vault configuration is loaded when in a region directory
 * - Directory names are inferred from the path structure
 * 
 * @param input - Configuration parameters
 * @returns Merged configuration with all defaults and computed values
 * 
 * @example
 * ```typescript
 * // Get config for current directory
 * const config = await getPanfactumConfig({ context });
 * 
 * // Get config for specific module
 * const moduleConfig = await getPanfactumConfig({
 *   context,
 *   directory: '/repo/environments/prod/us-east-1/vpc'
 * });
 * 
 * console.log(`Environment: ${moduleConfig.environment}`);
 * console.log(`Region: ${moduleConfig.region}`);
 * console.log(`Module: ${moduleConfig.module}`);
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when directory is not an absolute path
 * 
 * @see {@link getConfigValuesFromFile} - For reading individual config files
 * @see {@link PANFACTUM_CONFIG_SCHEMA} - Schema for configuration validation
 * @see {@link getVaultToken} - For fetching Vault authentication
 */
export const getPanfactumConfig = async ({
  context,
  directory = process.cwd(),
}: IGetPanfactumConfigInput): Promise<IOutputValues> => {

  // Get the actual file contents for each config file
  const configFileValues: Partial<{
    [fileName in (typeof CONFIG_FILE_PRECEDENCE)[number]]: InputValues;
  }> = {};
  const searchPromises: Array<Promise<void>> = [];

  if (!directory.startsWith("/")) {
    throw new CLIError(`getPanfactumConfig must be called with an absolute path. Given '${directory}'`)
  }
  let currentDir = directory;
  while (currentDir !== context.devshellConfig.repo_root && currentDir !== "/" && currentDir !== ".") {
    CONFIG_FILE_PRECEDENCE.forEach((fileName) => {
      searchPromises.push(
        (async () => {
          const filePath = join(currentDir, fileName);
          const values = await getConfigValuesFromFile({ context, filePath, secret: fileName.includes("secret") })
          if (values) {
            configFileValues[fileName] = values;
          }
        })()
      );
    });
    currentDir = dirname(currentDir);
  }
  await Promise.all(searchPromises);

  // Merge all the values
  let values: Partial<IOutputValues> = {};
  for (const fileName of CONFIG_FILE_PRECEDENCE) {
    const toMerge = configFileValues[fileName];
    if (toMerge) {
      values = {
        ...values,
        ...toMerge,
        extra_tags: {
          ...(values.extra_tags ?? {}),
          ...(toMerge.extra_tags ?? {}),
        },
        extra_inputs: {
          ...(values.extra_inputs ?? {}),
          ...(toMerge.extra_inputs ?? {}),
        },
        domains: {
          ...(values.domains ?? {}),
          ...(toMerge.domains ?? {})
        }
      };
    }
  }

  // Provide defaults
  const inEnvDir = directory.startsWith(context.devshellConfig.environments_dir);
  const parts = inEnvDir
    ? directory
      .substring(context.devshellConfig.environments_dir.length + 1)
      .split("/")
    : [];
  if (values.tf_state_account_id === undefined) {
    values.tf_state_account_id = values.aws_account_id;
  }
  if (values.tf_state_profile === undefined) {
    values.tf_state_profile = values.aws_profile;
  }
  if (values.aws_secondary_account_id === undefined) {
    values.aws_secondary_account_id = values.aws_account_id;
  }
  if (values.aws_secondary_profile === undefined) {
    values.aws_secondary_profile = values.aws_profile;
  }
  if (values.pf_stack_local_use_relative === undefined) {
    values.pf_stack_local_use_relative = true;
  }
  if (values.extra_tags === undefined) {
    values.extra_tags = {};
  }
  if (values.extra_inputs === undefined) {
    values.extra_inputs = {};
  }
  if (values.environment === undefined && parts.length >= 1) {
    values.environment = parts[0];
  }
  if (values.region === undefined && parts.length >= 2) {
    values.region = parts[1];
  }
  if (values.module === undefined && parts.length >= 3) {
    values.module = parts[2];
  }
  if (values.kube_name === undefined) {
    if (values.kube_config_context !== undefined) {
      values.kube_name = values.kube_config_context; // For backwards compatibility
    } else if (parts.length >= 2) {
      values.kube_name = `${values.environment}-${values.region}`;
    }
  }
  if (values.kube_config_context === undefined) {
    values.kube_config_context = values.kube_name;
  }
  if (values.version === undefined) {
    values.version = "local";
  }

  // Provide computed values
  if (parts.length >= 1) {
    values.environment_dir = parts[0]!
  }
  if (parts.length >= 2) {
    values.region_dir = parts[1]!;
  }
  if (parts.length >= 3) {
    values.module_dir = parts[2]!;
  }

  if (values.region_dir) {
    const isCi = context.env['CI'] === 'true' || context.env['CI'] === '1';

    values.vault_addr = (isCi
      ? context.env['VAULT_ADDR']
      : values.vault_addr
        ? values.vault_addr
        : context.env['VAULT_ADDR']) ?? '@@TERRAGRUNT_INVALID@@'

    values.vault_token = values.vault_addr ?
      values.vault_token
        ? values.vault_token
        : await getVaultToken({
          context,
          address: values.vault_addr,
          silent: true,
        }).catch(() => '@@TERRAGRUNT_INVALID@@')
      : '@@TERRAGRUNT_INVALID@@';
  }

  return values as IOutputValues;
}
