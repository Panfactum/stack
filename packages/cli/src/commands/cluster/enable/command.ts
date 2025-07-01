// This command enables optional features for existing Kubernetes clusters
// It provides post-installation configuration capabilities

import {Command, Option} from "clipanion";
import { z } from "zod";
import {PanfactumCommand} from "@/util/command/panfactumCommand.ts";

import { getEnvironments } from "@/util/config/getEnvironments";
import { getRegions } from "@/util/config/getRegions";
import {CLIError, PanfactumZodError} from "@/util/error/error.ts";
import {GLOBAL_REGION, MANAGEMENT_ENVIRONMENT } from "@/util/terragrunt/constants";
import { setupECR } from "./setupECR";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Schema for validating feature names
 * 
 * @remarks
 * Defines the set of valid features that can be enabled on a cluster.
 * Each feature represents an optional component or configuration.
 * 
 * @example
 * ```typescript
 * const validFeature = featureSchema.parse('ecr-pull-through-cache');
 * const invalidFeature = featureSchema.parse('unknown-feature'); // Throws
 * ```
 */
const featureSchema = z.enum([
  "ecr-pull-through-cache",
  // Add more features as needed
])
.describe('Valid cluster features that can be enabled');

/**
 * Constants for available cluster features
 * 
 * @remarks
 * Provides type-safe references to feature names for use in
 * switch statements and conditional logic.
 */
const FEATURE = {
  /** AWS ECR pull-through cache for container images */
  ECR_PULL_THROUGH_CACHE: "ecr-pull-through-cache" as const,
  // Add more features as needed
} as const;

/**
 * Options for enabling cluster features
 * 
 * @remarks
 * Common parameters passed to feature setup functions
 */
export interface IFeatureEnableOptions {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** File system path to the cluster configuration */
  clusterPath: string;
  /** AWS region name where the cluster is deployed */
  region: string;
  /** Environment name containing the cluster */
  environment: string;
}

/**
 * Command for enabling optional features on existing clusters
 * 
 * @remarks
 * This command allows post-installation configuration of Kubernetes
 * clusters by enabling optional features that aren't part of the
 * default installation. Features can be enabled at any time after
 * the cluster is running.
 * 
 * Key characteristics:
 * - Interactive environment and region selection
 * - Validates cluster exists before enabling features
 * - Feature-specific setup logic
 * - Idempotent operations
 * 
 * Available features:
 * - **ecr-pull-through-cache**: Configures AWS ECR pull-through
 *   cache to reduce image pull times and improve reliability
 * 
 * The command ensures:
 * - Only valid features can be enabled
 * - Features are applied to existing clusters only
 * - Proper error handling for feature setup failures
 * - Clear user feedback on feature enablement
 * 
 * Prerequisites:
 * - Cluster must be fully deployed
 * - User must have appropriate AWS permissions
 * - Feature-specific requirements must be met
 * 
 * @example
 * ```bash
 * # Enable ECR pull-through cache
 * pf cluster enable --feature ecr-pull-through-cache
 * 
 * # Short form
 * pf cluster enable -f ecr-pull-through-cache
 * ```
 * 
 * @see {@link setupECR} - ECR pull-through cache setup
 */
export class ClusterEnableCommand extends PanfactumCommand {
  static override paths = [["cluster", "enable"]];

  static override usage = Command.Usage({
    description: "Enable features for a cluster",
    category: 'Cluster',
    details: `
Enables optional features on existing Kubernetes clusters.

This command allows you to add capabilities that aren't included in the
default cluster installation. Features can be enabled at any time after
the cluster is operational.

Available Features:

• ecr-pull-through-cache
  Configures AWS ECR pull-through cache for faster and more reliable
  container image pulls. This reduces bandwidth usage and improves
  pod startup times.
    `,
    examples: [
      [
        "Enable ECR pull-through cache",
        "pf cluster enable --feature ecr-pull-through-cache"
      ],
      [
        "Enable using short flag",
        "pf cluster enable -f ecr-pull-through-cache"
      ]
    ],
  });

  /**
   * Feature name to enable
   * 
   * @remarks
   * Must be one of the supported feature names. The command validates
   * this against the featureSchema before processing.
   */
  feature: string = Option.String("--feature,-f", {
    description: "The feature to enable for the cluster",
    arity: 1,
    required: true
  });

  /**
   * Executes the feature enablement process
   * 
   * @remarks
   * This method performs the following steps:
   * 1. Validates the requested feature name
   * 2. Lists available environments (excluding management)
   * 3. Prompts for environment selection
   * 4. Lists regions with deployed clusters
   * 5. Prompts for region/cluster selection
   * 6. Executes feature-specific setup logic
   * 
   * Each feature has its own setup function that handles
   * the specific configuration requirements.
   * 
   * @throws {@link PanfactumZodError}
   * Throws when an invalid feature name is provided
   * 
   * @throws {@link CLIError}
   * Throws when no environments exist, no clusters are deployed,
   * or feature setup fails
   */
  async execute() {
    // Validate and get properly typed feature
    const featureResult = featureSchema.safeParse(this.feature);
    if (!featureResult.success) {
      throw new PanfactumZodError(
        'Invalid feature provided',
        'feature parameter',
        featureResult.error
      );
    }
    const validatedFeature = featureResult.data;

    /*******************************************
     * Select Environment and Region
     *******************************************/
    const environments = (await getEnvironments(this.context)).filter(env => env.name !== MANAGEMENT_ENVIRONMENT && env.deployed);

    if (environments.length === 0) {
      throw new CLIError([
        "No environments found. Please run `pf env add` to create an environment first.",
      ]);
    }

    const selectedEnvironment = await this.context.logger.select({
      message: "Select the environment for the cluster:",
      choices: environments.map(env => ({
        value: env,
        name: `${env.name}`
      })),
    });

    const regions = (await getRegions(this.context, selectedEnvironment.path)).filter(region => region.name !== GLOBAL_REGION && region.clusterDeployed);

    if (regions.length === 0) {
      throw new CLIError([
        `No available regions found in environment ${selectedEnvironment.name}.`,
      ]);
    }

    const selectedRegion = await this.context.logger.select({
      message: "Select the region for the cluster:",
      choices: regions.map(region => ({
        value: region,
        name: `${region.name}`
      })),
    });

    // Use the validated feature in the implementation
    switch (validatedFeature) {
      case FEATURE.ECR_PULL_THROUGH_CACHE: {
        // Implement ECR pull-through cache logic
        const tasks = await setupECR({
          environment: selectedEnvironment.name,
          region: selectedRegion.name,
          context: this.context,
          clusterPath: selectedRegion.path,
        })
        await tasks.run()
        break;
      }
      // Add cases for other features as needed
      default:
        throw new CLIError(`Unhandled feature: ${String(validatedFeature)}`);
    }
  }
}