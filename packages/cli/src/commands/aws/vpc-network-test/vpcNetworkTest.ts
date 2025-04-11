import path from "node:path";
import { z } from "zod";
import { CLIError } from "@/util/error/error";
import { fileExists } from "@/util/fs/fileExists";
import { getInstanceId } from "../../../util/aws/getInstanceId";
import { getSSMCommandOutput } from "../../../util/aws/getSSMCommandOutput";
import { runSsmCommand } from "../../../util/aws/runSSMCommand";
import { scaleASG } from "../../../util/aws/scaleASG";
import { testVPCNetworkBlocking } from "../../../util/aws/testVPCNetworkBlocking";
import { terragruntOutput } from "../../../util/terragrunt/terragruntOutput";
import { getPanfactumConfig } from "../../config/get/getPanfactumConfig";
import type { PanfactumContext } from "../../../context/context";

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
  context,
  modulePath,
}: {
  context: PanfactumContext;
  modulePath: string;
}) => {
  //####################################################################
  // Step 0: Validation
  //####################################################################
  const awsDir = context.repoVariables.aws_dir;
  const awsConfigFile = path.join(awsDir, "config");

  if (!(await fileExists(awsConfigFile))) {
    throw new Error("No AWS config file found.");
  }

  //####################################################################
  // Step 1: Get aws_vpc module outputs
  //####################################################################

  const moduleOutputs = await terragruntOutput({
    context,
    modulePath,
    validationSchema: AWS_VPC_MODULE_OUTPUTS,
  });

  //####################################################################
  // Step 2: Select AWS profile to use to run the test
  //####################################################################
  const { aws_profile: awsProfile } = await getPanfactumConfig({
    context,
    directory: modulePath,
  });

  if (!awsProfile) {
    throw new CLIError(
      `Was not able to retrive an AWS profile for module at ${modulePath}`
    );
  }

  //####################################################################
  // Step 3: Run the tests
  //####################################################################

  const subnets = moduleOutputs.test_config.value.subnets;
  const awsRegion = moduleOutputs.test_config.value.region;

  try {
    // Run the tests sequentially for all subnets
    for (const subnet of subnets) {
      context.logger.log(`Running test for subnet: ${subnet.subnet}...`);

      const asg = subnet.asg;
      const natIp = subnet.nat_ip;

      // Step 1: Create a test instance
      await scaleASG({
        asgName: asg,
        awsProfile,
        awsRegion,
        context,
        desiredCapacity: 1,
      });

      // Step 2: Get the instance id
      const finishGettingInstanceId = context.logger.progressMessage(
        "Waiting for instance to be created",
        {
          interval: 10000,
        }
      );
      const instanceId = await getInstanceId({
        asgName: asg,
        awsProfile,
        awsRegion: moduleOutputs.test_config.value.region,
        context,
      });
      finishGettingInstanceId();

      // Step 3: Run the network test
      const commandHasStarted = context.logger.progressMessage(
        `Waiting for instance ${instanceId} to become ready`,
        {
          interval: 5000,
        }
      );
      const commandId = await runSsmCommand({
        instanceId,
        awsProfile,
        awsRegion,
        context,
      });
      commandHasStarted();

      // Step 4: Get the result of the network test
      const gotComamndOutput = context.logger.progressMessage(
        "Waiting for test to complete",
        {
          interval: 5000,
        }
      );
      const publicIp = await getSSMCommandOutput({
        commandId,
        instanceId,
        awsProfile,
        awsRegion,
        context,
      });
      gotComamndOutput();

      // Step 5: Ensure the public IP is correct
      if (publicIp !== natIp) {
        throw new CLIError(
          `${instanceId} is NOT routing traffic thorugh through NAT!`
        );
      }

      // Step 6: Ensure that the NAT_IP rejects inbound traffic
      await testVPCNetworkBlocking({
        natIp,
        context,
      });

      context.logger.log(
        `\rTest completed successfully for ${subnet.subnet}.`,
        {
          style: "success",
        }
      );
      context.logger.log(
        "-----------------------------------------------------"
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
