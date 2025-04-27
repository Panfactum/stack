import path from "node:path";
import { z } from "zod";
import { CLIError } from "@/util/error/error";
import { fileExists } from "@/util/fs/fileExists";
import { execute } from "@/util/subprocess/execute";
import { MODULES } from "@/util/terragrunt/constants";
import { getSSMCommandOutput } from "../../../util/aws/getSSMCommandOutput";
import { scaleASG } from "../../../util/aws/scaleASG";
import { terragruntOutput } from "../../../util/terragrunt/terragruntOutput";
import type { PanfactumContext } from "../../../context/context";
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
        desiredCapacity: 1,
        task,
      });

      // Step 2: Get the instance id
      task.output = context.logger.applyColors("Waiting for instance to be created", {
        style: "subtle",
      });
      const { stdout: instanceId } = await execute({
        command: [
          "aws",
          "--region",
          awsRegion,
          "--profile",
          awsProfile,
          "autoscaling",
          "describe-auto-scaling-groups",
          "--auto-scaling-group-names",
          asg,
          "--query",
          "AutoScalingGroups[0].Instances[0].InstanceId",
          "--output",
          "text",
        ],
        context,
        workingDirectory: process.cwd(),
        errorMessage: "Failed to get instance ID",
        retries: 10,
        retryDelay: 10000,
        isSuccess({ stdout }) {
          return stdout !== "None" && stdout !== "";
        },
      });

      // Step 3: Run the network test
      task.output = context.logger.applyColors(
        `Waiting for instance ${instanceId} to become ready`,
        { style: "subtle" }
      );
      const { stdout: commandId } = await execute({
        command: [
          "aws",
          "--region",
          awsRegion,
          "--profile",
          awsProfile,
          "ssm",
          "send-command",
          "--instance-ids",
          instanceId,
          "--document-name",
          "AWS-RunShellScript",
          "--comment",
          "Get Public IP",
          "--parameters",
          'commands=["curl -m 10 ifconfig.me"]',
          "--query",
          "Command.CommandId",
          "--output",
          "text",
        ],
        context,
        workingDirectory: process.cwd(),
        errorMessage: `Failed to execute SSM command`,
        retries: 20,
      });

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
      await execute({
        command: ["ping", "-q", "-w", "3", "-c", "1", natIp],
        context,
        workingDirectory: process.cwd(),
        errorMessage: `Network traffic not blocked to ${natIp}!`,
        isSuccess: ({ stdout }) => stdout.includes("100% packet loss"),
      });

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
