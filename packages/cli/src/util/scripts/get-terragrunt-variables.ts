import { dirname } from "node:path";
import * as yaml from "yaml";
import type { BaseContext } from "clipanion";

/**
 * Returns a JSON object containing the Terragrunt variables that Terragrunt would use
 * if it were run in the given directory.
 *
 * Terragrunt variables are the Panfactum-specific configuration settings defined here:
 * https://panfactum.com/docs/edge/reference/configuration/terragrunt-variables.
 */
export const getTerragruntVariables = async (
  context: BaseContext
): Promise<Record<string, unknown>> => {
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

    return merged;
  } else {
    context.stdout.write("Warning: No configuration files found.");
    return {};
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
