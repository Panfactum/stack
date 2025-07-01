// This command tests VPC network connectivity after aws_vpc module deployment
// It ensures proper network configuration and connectivity

import { Command } from "clipanion";
import { Listr } from "listr2";
import { vpcNetworkTest } from "@/util/aws/vpcNetworkTest";
import { PanfactumCommand } from "@/util/command/panfactumCommand";
import { getAllRegions } from "@/util/config/getAllRegions.ts";
import { getPanfactumConfig } from "@/util/config/getPanfactumConfig.ts";
import { CLIError } from "@/util/error/error";
import { GLOBAL_REGION, MODULES } from "@/util/terragrunt/constants.ts";
import { getModuleStatus } from "@/util/terragrunt/getModuleStatus.ts";

/**
 * Command for testing VPC network connectivity
 * 
 * @remarks
 * This command validates that VPC networking is properly configured
 * after deploying the aws_vpc module. It performs comprehensive
 * connectivity tests to ensure all network components are functioning
 * correctly.
 * 
 * Key features:
 * - Interactive region selection
 * - Validates aws_vpc module deployment status
 * - Tests network connectivity within the VPC
 * - Provides detailed progress feedback
 * 
 * Prerequisites:
 * - aws_vpc module must be deployed successfully
 * - AWS credentials must be configured
 * - No Kubernetes cluster should be deployed in the region
 * 
 * The command is essential for:
 * - Post-deployment validation
 * - Troubleshooting network issues
 * - Ensuring VPC readiness before further deployments
 * - CI/CD pipeline validation steps
 * 
 * @example
 * ```bash
 * # Test VPC connectivity interactively
 * pf aws vpc-network-test
 * 
 * # Select region when prompted
 * # Command will validate and test the VPC
 * ```
 * 
 * @see {@link vpcNetworkTest} - Core network testing logic
 * @see {@link getModuleStatus} - For checking module deployment status
 */
export class AWSVPCNetworkTestCommand extends PanfactumCommand {
  static override paths = [["aws", "vpc-network-test"]];
  static override usage = Command.Usage({
    description: "To ensure connectivity after deploying the aws_vpc modules",
    category: 'AWS',
    details:
      "This command is intended to test to ensure connectivity after deploying the aws_vpc modules",
    examples: [
      [
        "Test VPC network connectivity",
        "pf aws vpc-network-test --module-path <path-to-aws-vpc-module>",
      ],
    ],
  });

  /**
   * Executes the VPC network test command
   * 
   * @remarks
   * Performs the following steps:
   * 1. Lists available regions (excluding global and those with clusters)
   * 2. Prompts user to select a region
   * 3. Validates aws_vpc module is deployed successfully
   * 4. Retrieves AWS credentials for the region
   * 5. Runs comprehensive network connectivity tests
   * 
   * @throws {@link CLIError}
   * Throws when no regions are available, module not deployed,
   * or AWS profile is missing
   */
  async execute(): Promise<void> {
    const regions = (await getAllRegions(this.context)).filter(region => region.name !== GLOBAL_REGION && !region.clusterDeployed)

    if (regions.length === 0) {
      throw new CLIError([
        `No available regions found.`,
      ]);
    }

    const selectedRegion = await this.context.logger.select({
      message: "Select the region where aws_vpc is deployed:",
      choices: regions.map(region => ({
        value: region,
        name: `${region.name}`
      })),
    });

    const moduleStatus = await getModuleStatus({
      context: this.context,
      module: MODULES.AWS_VPC,
      region: selectedRegion.name,
      environment: selectedRegion.environment,
    })

    if (moduleStatus.deploy_status !== "success") {
      throw new CLIError(`The aws_vpc module in region ${selectedRegion.name} is not deployed successfully. Current status: ${moduleStatus.deploy_status}`);
    }

    const config = await getPanfactumConfig({
      context: this.context,
      directory: selectedRegion.path,
    });

    const awsProfile = config.aws_profile;

    if (!awsProfile) {
      throw new CLIError("No AWS profile found in the selected region.");
    }

    const tasks = new Listr([], { rendererOptions: { collapseErrors: false } });

    tasks.add({
      title: `Testing VPC network connectivity for region ${selectedRegion.name} in ${selectedRegion.environment}`,
      task: async (_, task) => {
        await vpcNetworkTest({
          awsProfile,
          context: this.context,
          environment: selectedRegion.environment,
          region: selectedRegion.name,
          task: task,
        });
      }
    })

    await tasks.run();
  }
}
