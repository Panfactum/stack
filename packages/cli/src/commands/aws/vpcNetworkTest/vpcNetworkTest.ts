import path from "node:path";
import { z } from "zod";
import { DescribeAutoScalingGroupsCommand } from "@aws-sdk/client-auto-scaling";
import { SendCommandCommand } from "@aws-sdk/client-ssm";
import { CLIError } from "@/util/error/error";
import { fileExists } from "@/util/fs/fileExists";
import { checkConnection } from "@/util/network/checkConnection";
import { MODULES } from "@/util/terragrunt/constants";
import { getAutoScalingClient } from "../../../util/aws/clients/getAutoScalingClient";
import { getSSMClient } from "../../../util/aws/clients/getSSMClient";
import { getSSMCommandOutput } from "../../../util/aws/getSSMCommandOutput";
import { scaleASG } from "../../../util/aws/scaleASG";
import { terragruntOutput } from "../../../util/terragrunt/terragruntOutput";
import type { PanfactumContext } from "../../../util/context/context";
import type { PanfactumTaskWrapper } from "@/util/listr/types";

/**
 * Wait for an instance to be created in an Auto Scaling Group
 */
async function waitForASGInstance(
  asg: string,
  awsProfile: string,
  awsRegion: string,
  context: PanfactumContext
): Promise<string> {
  let retries = 0;
  const maxRetries = 10;
  const retryDelay = 10000;

  while (retries < maxRetries) {
    try {
      const client = await getAutoScalingClient({ 
        context, 
        profile: awsProfile, 
        region: awsRegion 
      });

      const result = await client.send(new DescribeAutoScalingGroupsCommand({
        AutoScalingGroupNames: [asg]
      }));

      const instance = result.AutoScalingGroups?.[0]?.Instances?.[0];
      if (instance?.InstanceId) {
        return instance.InstanceId;
      }

      // No instance found yet, retry
      if (retries < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retries++;
      } else {
        throw new CLIError("Failed to get instance ID - no instances found in ASG");
      }
    } catch (error) {
      if (retries < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retries++;
      } else {
        throw new CLIError("Failed to get instance ID", { cause: error });
      }
    }
  }
  
  throw new CLIError("Failed to get instance ID after all retries");
}

/**
 * Send an SSM command to an instance with retry logic
 */
async function sendSSMCommand(
  instanceId: string,
  awsProfile: string,
  awsRegion: string,
  context: PanfactumContext
): Promise<string> {
  let ssmRetries = 0;
  const maxSSMRetries = 20;

  while (ssmRetries < maxSSMRetries) {
    try {
      const ssmClient = await getSSMClient({ 
        context, 
        profile: awsProfile, 
        region: awsRegion 
      });

      const result = await ssmClient.send(new SendCommandCommand({
        InstanceIds: [instanceId],
        DocumentName: "AWS-RunShellScript",
        Comment: "Get Public IP",
        Parameters: {
          commands: ["curl -m 10 ifconfig.me"]
        }
      }));

      if (!result.Command?.CommandId) {
        throw new CLIError("No command ID returned from SSM send-command");
      }

      return result.Command.CommandId;
    } catch (error) {
      if (ssmRetries < maxSSMRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        ssmRetries++;
      } else {
        throw new CLIError("Failed to execute SSM command", { cause: error });
      }
    }
  }
  
  throw new CLIError("Failed to execute SSM command after all retries");
}

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
