import {Command, Option} from "clipanion";
import { z } from "zod";
import {PanfactumCommand} from "@/util/command/panfactumCommand.ts";

import { getEnvironments } from "@/util/config/getEnvironments";
import { getRegions } from "@/util/config/getRegions";
import {CLIError} from "@/util/error/error.ts";
import {GLOBAL_REGION, MANAGEMENT_ENVIRONMENT } from "@/util/terragrunt/constants";
import { setupECR } from "./setupECR";
import type { PanfactumContext } from "@/util/context/context";

// Zod schema for feature validation
const featureSchema = z.enum([
  "ecr-pull-through-cache",
  // Add more features as needed
]);

// Create feature constants for switch statement
const FEATURE = {
  ECR_PULL_THROUGH_CACHE: "ecr-pull-through-cache" as const,
  // Add more features as needed
} as const;

export interface FeatureEnableOptions {
  context: PanfactumContext,
  clusterPath: string,
  region: string,
  environment: string,
}

export class ClusterEnableCommand extends PanfactumCommand {
  static override paths = [["cluster", "enable"]];

  static override usage = Command.Usage({
    description: "Enable Cluster Features",
    details:
      "This command adds and enables features for a cluster. This is typically used to enable features that are not enabled by default.\n\n" +
      "Feature List\n\n" +
      "- ecr-pull-through-cache: enables pull through cache for the cluster \n",
    examples: [["Enable ECR pull-through cache", "pf cluster enable ecr-pull-through-cache"]],
  });

  feature: string = Option.String("--feature,-f", {
    description: "The feature to enable for the cluster",
    arity: 1,
    required: true
  });

  async execute() {
    // Validate and get properly typed feature
    const validatedFeature = featureSchema.parse(this.feature)

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