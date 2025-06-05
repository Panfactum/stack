import { Command } from "clipanion";
import { Listr } from "listr2";
import { PanfactumCommand } from "@/util/command/panfactumCommand";
import { getEnvironments } from "@/util/config/getEnvironments";
import { getPanfactumConfig } from "@/util/config/getPanfactumConfig.ts";
import { getRegions } from "@/util/config/getRegions.ts";
import { CLIError } from "@/util/error/error";
import { GLOBAL_REGION, MANAGEMENT_ENVIRONMENT } from "@/util/terragrunt/constants.ts";
import { vpcNetworkTest } from "./vpcNetworkTest";

export class AWSVPCNetworkTestCommand extends PanfactumCommand {
  static override paths = [["aws", "vpc-network-test"]];
  static override usage = Command.Usage({
    description: "To ensure connectivity after deploying the aws_vpc modules",
    details:
      "This command is intended to test to ensure connectivity after deploying the aws_vpc modules",
    examples: [
      [
        "Test VPC network connectivity",
        "pf aws vpc-network-test --module-path <path-to-aws-vpc-module>",
      ],
    ],
  });

  async execute() {

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

    const regions = (await getRegions(this.context, selectedEnvironment.path)).filter(region => region.name !== GLOBAL_REGION && !region.clusterDeployed);

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

    const config = await getPanfactumConfig({
      context: this.context,
      directory: selectedRegion.path,
    });

    interface Context {

    }

    const tasks = new Listr<Context>([], { rendererOptions: { collapseErrors: false } });

    tasks.add({
      title: `Testing VPC network connectivity for environment ${selectedEnvironment.name} in region ${selectedRegion.name}`,
      task: async (_, task) => {
        if (!config.aws_profile) {
          throw new CLIError("No AWS profile found in the selected region.");
        }

        await vpcNetworkTest({
          awsProfile: config.aws_profile,
          context: this.context,
          environment: selectedEnvironment.name,
          region: selectedRegion.name,
          task: task,
        });
      }
    })

    await tasks.run();
  }
}
