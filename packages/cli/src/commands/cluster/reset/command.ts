// This command resets an EKS cluster by removing default AWS resources
// It is intended for use when a full re-installation is needed

import path from "node:path";
import { Command, Option } from "clipanion";
import { Listr } from "listr2";
import { z } from "zod";
import { PanfactumCommand } from "@/util/command/panfactumCommand";
import { getEnvironments } from "@/util/config/getEnvironments";
import { getPanfactumConfig } from "@/util/config/getPanfactumConfig";
import { getRegions } from "@/util/config/getRegions";
import { CLIError } from "@/util/error/error";
import { GLOBAL_REGION, MANAGEMENT_ENVIRONMENT, MODULES } from "@/util/terragrunt/constants";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import { clusterReset } from "./clusterReset";

/**
 * Command for resetting an EKS cluster to remove default AWS resources
 *
 * @remarks
 * This command removes the default resources that AWS automatically installs
 * in EKS clusters, preparing them for Panfactum's hardened replacements.
 *
 * By default, resources with the `panfactum.com/workload` label are preserved
 * to avoid destroying Panfactum-managed infrastructure. Pass `--force` to
 * override this protection and delete those resources as well.
 *
 * This command is idempotent: resources that no longer exist are silently
 * ignored.
 *
 * @example
 * ```bash
 * # Safe reset — preserves Panfactum-managed resources
 * pf cluster reset
 *
 * # Full reset — also removes resources with the panfactum.com/workload label
 * pf cluster reset --force
 * ```
 *
 * @see {@link clusterReset} - Core reset logic
 */
export class ClusterResetCommand extends PanfactumCommand {
  static override paths = [["cluster", "reset"]];

  static override usage = Command.Usage({
    description: "Reset an EKS cluster by removing default AWS resources",
    category: "Cluster",
    details: `
Removes the default resources that AWS automatically installs in EKS clusters,
preparing them for Panfactum's hardened replacements.

By default, resources that carry the panfactum.com/workload label are skipped
to protect Panfactum-managed infrastructure during a resumed installation.
Use --force to delete those resources as well (intended for full re-installations).
    `,
    examples: [
      ["Reset cluster (preserves Panfactum-managed resources)", "pf cluster reset"],
      ["Full reset including Panfactum-managed resources", "pf cluster reset --force"],
    ],
  });

  /**
   * When set, deletes resources even if they carry the `panfactum.com/workload` label.
   *
   * @remarks
   * Use only when performing a complete re-installation, not when resuming
   * a failed install.
   */
  force = Option.Boolean("--force", false, {
    description:
      "Also delete resources with the panfactum.com/workload label. " +
      "Use only for full re-installations, not when resuming a failed install.",
  });

  /**
   * Executes the cluster reset process
   *
   * @remarks
   * Prompts for environment and region selection, reads the cluster name
   * from the saved EKS module configuration, then runs {@link clusterReset}.
   *
   * @throws {@link CLIError}
   * Throws when no environments or deployed clusters are found, required
   * configuration is missing, or the reset operation fails
   */
  async execute() {
    /*******************************************
     * Select Environment and Region
     *******************************************/
    const environments = (await getEnvironments(this.context)).filter(
      (env) => env.name !== MANAGEMENT_ENVIRONMENT && env.deployed,
    );

    if (environments.length === 0) {
      throw new CLIError([
        "No environments found. Please run `pf env add` to create an environment first.",
      ]);
    }

    const selectedEnvironment = await this.context.logger.select({
      message: "Select the environment for the cluster:",
      choices: environments.map((env) => ({ value: env, name: env.name })),
    });

    const regions = (
      await getRegions(this.context, selectedEnvironment.path)
    ).filter((region) => region.name !== GLOBAL_REGION && region.clusterDeployed);

    if (regions.length === 0) {
      throw new CLIError([
        `No deployed clusters found in environment ${selectedEnvironment.name}.`,
      ]);
    }

    const selectedRegion = await this.context.logger.select({
      message: "Select the region for the cluster:",
      choices: regions.map((region) => ({ value: region, name: region.name })),
    });

    /*******************************************
     * Load Configuration
     *******************************************/
    const config = await getPanfactumConfig({
      context: this.context,
      directory: selectedRegion.path,
    });

    const { aws_profile: awsProfile, aws_region: awsRegion } = config;

    if (!awsProfile || !awsRegion) {
      throw new CLIError([
        "Could not read aws_profile or aws_region from region configuration.",
      ]);
    }

    const eksModuleConfig = await readYAMLFile({
      filePath: path.join(selectedRegion.path, MODULES.AWS_EKS, "module.yaml"),
      context: this.context,
      throwOnMissing: true,
      validationSchema: z.object({
        extra_inputs: z.object({
          cluster_name: z.string(),
        }).passthrough(),
      }).passthrough(),
    });

    if (!eksModuleConfig) {
      throw new CLIError([
        `No EKS module configuration found at ${path.join(selectedRegion.path, MODULES.AWS_EKS, "module.yaml")}.`,
        "Has the cluster been initialized with `pf cluster add`?",
      ]);
    }

    const clusterName = eksModuleConfig.extra_inputs.cluster_name;

    /*******************************************
     * Run Reset
     *******************************************/
    const tasks = new Listr(
      [
        {
          title: "Reset the cluster",
          task: async (_, task) => {
            await clusterReset({
              awsProfile,
              clusterName,
              context: this.context,
              awsRegion,
              task,
              clusterPath: selectedRegion.path,
              force: this.force,
            });
          },
          rendererOptions: { outputBar: 5 },
        },
      ],
      { rendererOptions: { collapseErrors: false } },
    );

    try {
      await tasks.run();
    } catch (e) {
      throw new CLIError("Failed to reset cluster", e);
    }

    this.context.logger.success("Cluster reset complete.");
  }
}
