// This file provides utilities for testing VPC network connectivity
// It validates NAT gateway configuration and outbound routing

import path from "node:path";
import { z } from "zod";
import { getSSMCommandOutput } from "@/util/aws/getSSMCommandOutput.ts";
import { scaleASG } from "@/util/aws/scaleASG.ts";
import { sendSSMCommand } from "@/util/aws/sendSSMCommand.ts";
import { waitForASGInstance } from "@/util/aws/waitForASGInstance.ts";
import { CLIError } from "@/util/error/error";
import { fileExists } from "@/util/fs/fileExists";
import { checkConnection } from "@/util/network/checkConnection";
import { MODULES } from "@/util/terragrunt/constants";
import { terragruntOutput } from "@/util/terragrunt/terragruntOutput.ts";
import type { PanfactumContext } from "@/util/context/context.ts";
import type { PanfactumTaskWrapper } from "@/util/listr/types";

/**
 * Schema for validating AWS VPC module terraform outputs
 * 
 * @remarks
 * This schema ensures the VPC module provides the necessary test
 * configuration including subnets, ASGs, and NAT IP addresses.
 */
const AWS_VPC_MODULE_OUTPUTS = z.object({
  test_config: z.object({
    value: z.object({
      region: z.string(),
      subnets: z.array(
        z.object({
          asg: z.string(),
          nat_ip: z.string().ip(),
          subnet: z.string(),
        })
      ),
    }),
  }),
});

/**
 * Input parameters for VPC network testing
 */
interface IVPCNetworkTestInput {
  /** AWS profile to use for authentication */
  awsProfile: string;
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** Environment name to test */
  environment: string;
  /** AWS region where the VPC is located */
  region: string;
  /** Listr task wrapper for progress updates */
  task: PanfactumTaskWrapper;
}

/**
 * Tests VPC network connectivity and NAT gateway configuration
 * 
 * @remarks
 * This function performs comprehensive network testing for a VPC by:
 * 1. Creating test instances in each subnet
 * 2. Verifying outbound traffic routes through the correct NAT gateway
 * 3. Ensuring NAT gateways block inbound connections
 * 4. Automatically cleaning up test resources
 * 
 * The test validates that private subnet instances can reach the internet
 * through NAT gateways while remaining protected from inbound connections.
 * 
 * @param input - Configuration including AWS credentials and test parameters
 * 
 * @example
 * ```typescript
 * await vpcNetworkTest({
 *   awsProfile: 'production',
 *   context,
 *   environment: 'prod',
 *   region: 'us-east-1',
 *   task: listrTask
 * });
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when AWS config file is missing
 * 
 * @throws {@link CLIError}
 * Throws when instances are not routing through the correct NAT gateway
 * 
 * @throws {@link CLIError}
 * Throws when NAT gateways are not blocking inbound traffic
 * 
 * @see {@link scaleASG} - For creating and destroying test instances
 * @see {@link sendSSMCommand} - For executing network tests on instances
 * @see {@link checkConnection} - For validating NAT gateway security
 */
export const vpcNetworkTest = async (input: IVPCNetworkTestInput): Promise<void> => {
  const { awsProfile, context, environment, region, task } = input;

  //####################################################################
  // Step 0: Validation
  //####################################################################
  const awsDir = context.devshellConfig.aws_dir;
  const awsConfigFile = path.join(awsDir, "config");

  if (!(await fileExists({ filePath: awsConfigFile }))) {
    throw new CLIError("No AWS config file found.");
  }

  //####################################################################
  // Step 1: Get aws_vpc module outputs
  //####################################################################

  const moduleOutputs = await terragruntOutput({
    awsProfile,
    context,
    environment,
    region,
    module: MODULES.AWS_VPC,
    validationSchema: AWS_VPC_MODULE_OUTPUTS,
  });

  //####################################################################
  // Step 2: Run the tests
  //####################################################################

  const subnets = moduleOutputs.test_config.value.subnets;
  const awsRegion = moduleOutputs.test_config.value.region;

  try {
    // Run the tests sequentially for all subnets
    for (const subnet of subnets) {
      task.output = context.logger.applyColors(
        `Running test for subnet: ${subnet.subnet}...`,
        { style: "subtle" }
      );

      const asg = subnet.asg;
      const natIp = subnet.nat_ip;

      // Step 1: Create a test instance
      await scaleASG({
        asgName: asg,
        awsProfile,
        awsRegion,
        context,
        desiredCapacity: 1
      });

      // Step 2: Get the instance id
      task.output = context.logger.applyColors("Waiting for instance to be created", {
        style: "subtle",
      });

      const instanceId = await waitForASGInstance({ asg, awsProfile, awsRegion, context });

      // Step 3: Run the network test
      task.output = context.logger.applyColors(
        `Waiting for instance ${instanceId} to become ready`,
        { style: "subtle" }
      );

      const commandId = await sendSSMCommand({ instanceId, awsProfile, awsRegion, context });

      // Step 4: Get the result of the network test
      task.output = context.logger.applyColors("Waiting for test to complete", {
        style: "subtle",
      });
      const publicIp = await getSSMCommandOutput({
        commandId,
        instanceId,
        awsProfile,
        awsRegion,
        context,
      });

      // Step 5: Ensure the public IP is correct
      if (publicIp !== natIp) {
        throw new CLIError(`${instanceId} is NOT routing traffic through NAT!`);
      }

      // Step 6: Ensure that the NAT_IP rejects inbound traffic
      const isReachable = await checkConnection({ ip: natIp });
      if (isReachable) {
        throw new CLIError(`${natIp} is NOT blocking inbound traffic!`);
      }

      task.output = context.logger.applyColors(
        `Test completed successfully for ${subnet.subnet}.`,
        { style: "subtle" }
      );
    }
  } finally {
    // scale down all ASGs no matter what
    for (const subnet of subnets) {
      void scaleASG({
        asgName: subnet.asg,
        awsProfile,
        awsRegion,
        context,
        desiredCapacity: 0,
      });
    }
  }
};
