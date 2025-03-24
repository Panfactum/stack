import { dirname } from "node:path";
import * as yaml from "yaml";
import { z } from "zod";
import type { BaseContext } from "clipanion";

// See https://panfactum.com/docs/edge/reference/configuration/terragrunt-variables
const terragruntVariablesSchema = z.object({
  // Metadata
  environment: z.string(),
  region: z.string(),
  sla_target: z.number().int().min(1).max(3).optional(),
  extra_tags: z.record(z.string(), z.any()).optional(),
  // Inputs
  extra_inputs: z.record(z.string(), z.any()).optional(),
  // Module Source
  version: z.string().optional(),
  pf_stack_version: z.string().optional(),
  pf_stack_local_path: z.string().optional(),
  pf_stack_local_use_relative: z.boolean().optional(),
  module: z.string().optional(),
  // State Backend Setup
  tf_state_account_id: z.string(),
  tf_state_profile: z.string(),
  tf_state_region: z.string(),
  tf_state_bucket: z.string(),
  tf_state_lock_table: z.string(),
  // AWS Provider
  aws_account_id: z.string(),
  aws_profile: z.string(),
  aws_region: z.string(),
  aws_secondary_account_id: z.string().optional(),
  aws_secondary_profile: z.string().optional(),
  aws_secondary_region: z.string().optional(),
  // Kubernetes Provider
  kube_api_server: z.string(),
  kube_config_context: z.string(),
  // Vault Provider
  vault_addr: z.string(),
  // Authentik Provider
  authentik_url: z.string(),
});

/**
 * Returns a JSON object containing the Terragrunt variables that Terragrunt would use
 * if it were run in the given directory.
 *
 * Terragrunt variables are the Panfactum-specific configuration settings defined here:
 * https://panfactum.com/docs/edge/reference/configuration/terragrunt-variables.
 */
export const getTerragruntVariables = async ({
  context,
}: {
  context: BaseContext;
}): Promise<z.infer<typeof terragruntVariablesSchema>> => {
  const files = await getFiles(process.cwd());

  // If YAML files are found, merge and convert to JSON
  if (files.length > 0) {
    // Initialize the merged content
    let merged: Record<string, unknown> = {};

    // Process files in reverse order because:
    // 1. Files found at deeper paths should override those at shallower paths
    // 2. In each directory, files were added in order of precedence (user files before standard files)
    for (let i = files.length - 1; i >= 0; i--) {
      const filePath = files[i];
      try {
        if (filePath === undefined) continue;

        // Check if the file is empty or contains only comments
        const fileContent = await Bun.file(filePath).text();
        const nonCommentLines = fileContent
          .split("\n")
          .filter((line) => !line.trim().startsWith("#") && line.trim() !== "");

        if (nonCommentLines.length === 0) {
          continue;
        }

        const parsedYaml = yaml.parse(fileContent);
        if (parsedYaml !== undefined) {
          // Perform a shallow merge with parsed YAML taking precedence over existing values
          merged = { ...merged, ...parsedYaml };
        }
      } catch (error) {
        context.stderr.write(
          `Error processing file ${filePath}: ${String(error)}`
        );
      }
    }

    const validatedVariables = terragruntVariablesSchema.parse(merged);

    return validatedVariables;
  } else {
    context.stdout.write("Warning: No configuration files found.");
    throw new Error("No configuration files found.");
  }
};

async function isGitRoot(directory: string): Promise<boolean> {
  const gitDir = `${directory}/.git`;
  try {
    const stat = Bun.file(gitDir).stat();
    return stat !== null && (await stat).isDirectory();
  } catch {
    return false;
  }
}

async function getFiles(currentDir: string): Promise<string[]> {
  const files: string[] = [];

  // Find git root and collect all relevant YAML files
  while (!(await isGitRoot(currentDir)) && currentDir !== "/") {
    // User files take precedence
    const configFiles = [
      "module.user.yaml",
      "region.user.yaml",
      "environment.user.yaml",
      "global.user.yaml",
      "module.yaml",
      "region.yaml",
      "environment.yaml",
      "global.yaml",
    ];
    for (const fileName of configFiles) {
      const filePath = `${currentDir}/${fileName}`;
      if (await Bun.file(filePath).exists()) {
        files.push(filePath);
      }
    }

    // Move up to parent directory to avoid infinite loop
    currentDir = dirname(currentDir);
  }

  return files;
}
