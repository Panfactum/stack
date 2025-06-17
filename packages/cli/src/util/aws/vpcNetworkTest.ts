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

export const vpcNetworkTest = async ({
  awsProfile,
  context,
  environment,
  region,
  task,
}: {
  awsProfile: string;
  context: PanfactumContext;
  environment: string;
  region: string;
  task: PanfactumTaskWrapper;
}) => {
  //####################################################################
  // Step 0: Validation
  //####################################################################
  const awsDir = context.repoVariables.aws_dir;
  const awsConfigFile = path.join(awsDir, "config");

  if (!(await fileExists(awsConfigFile))) {
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
      
      const instanceId = await waitForASGInstance(asg, awsProfile, awsRegion, context);

      // Step 3: Run the network test
      task.output = context.logger.applyColors(
        `Waiting for instance ${instanceId} to become ready`,
        { style: "subtle" }
      );
      
      const commandId = await sendSSMCommand(instanceId, awsProfile, awsRegion, context);

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
      const isReachable = await checkConnection(natIp);
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
