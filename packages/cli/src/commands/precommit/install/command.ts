import { join } from "node:path";
import { Command, Option } from "clipanion";
import { z } from "zod";
import { PanfactumCommand } from "@/util/command/panfactumCommand";
import { CLIError } from "@/util/error/error";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import { writeYAMLFile } from "@/util/yaml/writeYAMLFile";

const CUSTOM_CONFIG_FILENAME = ".pre-commit-config.custom.yaml";
const OUTPUT_FILENAME = ".pre-commit-config.yaml";

/**
 * Permissive schema for pre-commit config files
 *
 * @remarks
 * Uses passthrough so that arbitrary top-level keys (e.g. `fail_fast`,
 * `exclude`, `default_stages`) are preserved during the merge.
 */
const precommitConfigSchema = z
  .object({
    repos: z.array(z.unknown()).default([]),
  })
  .passthrough();

/**
 * CLI command that merges Panfactum-generated pre-commit hooks with
 * optional user-defined hooks and writes the result to
 * `.pre-commit-config.yaml`.
 *
 * @remarks
 * This command is intended to be called from the devshell activation
 * script rather than directly by end-users. It:
 *
 * 1. Warns if `.pre-commit-config.yaml` is already tracked by git
 *    (it should be gitignored since it is generated).
 * 2. Reads the Panfactum config from `--config`.
 * 3. Optionally reads `.pre-commit-config.custom.yaml` from the repo root.
 * 4. Merges user config (top-level fields preserved) with Panfactum repos
 *    appended to the user's repos list.
 * 5. Writes the merged result to `.pre-commit-config.yaml`.
 *
 * @example
 * ```bash
 * pf precommit install --config /nix/store/...-precommit-config.yaml
 * ```
 *
 * @see {@link readYAMLFile} - YAML reading utility
 * @see {@link writeYAMLFile} - YAML writing utility
 */
export class PrecommitInstallCommand extends PanfactumCommand {
  static override paths = [["precommit", "install"]];

  static override usage = Command.Usage({
    description:
      "Merges Panfactum pre-commit hooks with user-defined hooks",
    category: "Devshell",
    details:
      "Reads the Panfactum-generated pre-commit config and an optional .pre-commit-config.custom.yaml, merges their repos arrays, and writes .pre-commit-config.yaml.",
  });

  /** Path to the Nix-generated Panfactum pre-commit config */
  config: string = Option.String("--config", {
    description: "Path to the Panfactum-generated pre-commit config file",
    required: true,
  });

  /**
   * Executes the pre-commit config merge
   *
   * @returns Exit code (0 for success)
   *
   * @throws {@link CLIError}
   * Throws when the Panfactum config file cannot be read or parsed
   */
  async execute() {
    const repoRoot = this.context.devshellConfig.repo_root;
    const outputPath = join(repoRoot, OUTPUT_FILENAME);
    const customConfigPath = join(repoRoot, CUSTOM_CONFIG_FILENAME);

    // Warn if .pre-commit-config.yaml is tracked by git
    const gitCheck = this.context.subprocessManager.execute({
      command: [
        "git",
        "ls-files",
        "--error-unmatch",
        OUTPUT_FILENAME,
      ],
      workingDirectory: repoRoot,
    });
    const { exitCode } = await gitCheck.exited;
    if (exitCode === 0) {
      this.context.logger.warn(
        [
          `${OUTPUT_FILENAME} already exists, but Panfactum now auto-generates this file.`,
          "",
          "Panfactum uses prek, a faster replacement for pre-commit, to run hooks on staged files before each commit.",
          "It merges its pre-commit hooks with your custom hooks so you get both",
          "Panfactum's checks and your own in a single config. To enable this:",
          "",
          `  1. Move your existing hooks from ${OUTPUT_FILENAME} to ${CUSTOM_CONFIG_FILENAME}`,
          `  2. Add ${OUTPUT_FILENAME} to your .gitignore`,
          `  3. Run: git rm --cached ${OUTPUT_FILENAME}`,
          "  4. Run: direnv reload",
          "",
          `Your hooks in ${CUSTOM_CONFIG_FILENAME} will be merged with Panfactum's automatically.`,
          "",
          "To disable Panfactum's auto-generated pre-commit checks entirely, set",
          '`precommit.enable = false` in your devshell configuration.',
        ].join("\n")
      );
    }

    // Read the Panfactum-generated config
    const panfactumConfig = await readYAMLFile({
      context: this.context,
      filePath: this.config,
      validationSchema: precommitConfigSchema,
    });

    if (!panfactumConfig) {
      throw new CLIError(
        `Panfactum pre-commit config at ${this.config} is empty or invalid`
      );
    }

    // Optionally read user's custom config
    const userConfig = await readYAMLFile({
      context: this.context,
      filePath: customConfigPath,
      validationSchema: precommitConfigSchema,
      throwOnMissing: false,
      throwOnEmpty: false,
    });

    // Merge configs: user top-level fields preserved, repos concatenated
    let merged: Record<string, unknown>;
    if (userConfig) {
      const { repos: userRepos, ...userRest } = userConfig;
      merged = {
        ...userRest,
        repos: [...userRepos, ...panfactumConfig.repos],
      };
    } else {
      merged = panfactumConfig;
    }

    // Write merged config
    await writeYAMLFile({
      context: this.context,
      filePath: outputPath,
      values: merged,
      overwrite: true,
    });

    return 0;
  }
}
