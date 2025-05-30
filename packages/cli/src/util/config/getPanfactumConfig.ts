import { dirname, join } from "node:path";
import { z } from "zod";
import { PANFACTUM_CONFIG_SCHEMA } from "@/util/config/schemas";
import { CLIError } from "@/util/error/error";
import { getVaultTokenString } from "@/util/vault";
import { getConfigValuesFromFile } from "./getConfigValuesFromFile";
import type { PanfactumContext } from "../context/context";

type InputValues = z.infer<typeof PANFACTUM_CONFIG_SCHEMA>;
type OutputValues = InputValues & {
  environment_dir?: string; // the environment directory name (as might differ from the environment name)
  region_dir?: string; // the region directory name (as might differ from region name)
  module_dir?: string; // the module directory name (as might differ from actual module name)
};

// WARNING: The order here is extremely important
// DO NOT CHANGE unless you know exactly what you are doing
const CONFIG_FILES = [
  "global.yaml",
  "global.secrets.yaml",
  "global.user.yaml",
  "environment.yaml",
  "environment.secrets.yaml",
  "environment.user.yaml",
  "region.yaml",
  "region.secrets.yaml",
  "region.user.yaml",
  "module.yaml",
  "module.secrets.yaml",
  "module.user.yaml",
] as const;

export const getPanfactumConfig = async ({
  context,
  directory = process.cwd(),
}: {
  context: PanfactumContext;
  directory?: string;
}): Promise<OutputValues> => {

  // Get the actual file contents for each config file
  const configFileValues: Partial<{
    [fileName in (typeof CONFIG_FILES)[number]]: InputValues;
  }> = {};
  const searchPromises: Array<Promise<void>> = [];

  if (!directory.startsWith("/")) {
    throw new CLIError(`getPanfactumConfig must be called with an absolute path. Given '${directory}'`)
  }
  let currentDir = directory;
  while (currentDir !== context.repoVariables.repo_root && currentDir !== "/" && currentDir !== ".") {
    CONFIG_FILES.forEach((fileName) => {
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
  let values: Partial<OutputValues> = {};
  for (const fileName of CONFIG_FILES) {
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
  const inEnvDir = directory.startsWith(context.repoVariables.environments_dir);
  const parts = inEnvDir
    ? directory
      .substring(context.repoVariables.environments_dir.length + 1)
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

    values.vault_token = values.vault_token
      ? values.vault_token
      : await getVaultTokenString({
          address: values.vault_addr,
          silent: true,
          noop: !!values.vault_addr,
        })
  }

  return values as OutputValues;
}
