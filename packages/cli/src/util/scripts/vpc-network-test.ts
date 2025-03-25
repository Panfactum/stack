import { existsSync } from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { z } from "zod";
import { getRepoVariables } from "./get-repo-variables";
import { getTerragruntVariables } from "./get-terragrunt-variables";
import { getInstanceId } from "./helpers/aws/get-instance-id";
import { getSsmCommandOutput } from "./helpers/aws/get-ssm-command-output";
import { runSsmCommand } from "./helpers/aws/run-ssm-command";
import { scaleAsg } from "./helpers/aws/scale-asg";
import { testVpcNetworkBlocking } from "./helpers/aws/test-vpc-network-blocking";
import { getModuleOutputs } from "./helpers/terragrunt/get-module-outputs";
import type { BaseContext } from "clipanion";

export const vpcNetworkTest = async ({
  context,
  modulePath,
  verbose = false,
}: {
  context: BaseContext;
  modulePath: string;
  verbose?: boolean;
}) => {
  //####################################################################
  // Step 0: Validation
  //####################################################################
  const repoVariables = await getRepoVariables({ context });

  const awsDir = repoVariables.aws_dir;
  const awsConfigFile = path.join(awsDir, "config");

  if (!existsSync(awsConfigFile)) {
    context.stderr.write(
      pc.red(`Error: No AWS config file found at ${awsConfigFile}.`)
    );
    throw new Error("No AWS config file found.");
  }

  //####################################################################
  // Step 1: Get aws_vpc module outputs
  //####################################################################
  const moduleOuputsValidationSchema = z.object({
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

  const moduleOutputs = getModuleOutputs({
    context,
    modulePath,
    validationSchema: moduleOuputsValidationSchema,
    verbose,
  });

  //####################################################################
  // Step 2: Select AWS profile to use to run the test
  //####################################################################
  const terragruntVariables = await getTerragruntVariables({
    context,
  });
  const awsProfile = terragruntVariables.aws_profile;

  //####################################################################
  // Step 3: Run the tests
  //####################################################################

  // Get the number of subnets to test
  const subnets = moduleOutputs.test_config.value.subnets;
  const numberOfSubnets = subnets.length;

  try {
    // Run the tests sequentially for all subnets
    for (let i = 0; i < numberOfSubnets; i++) {
      const subnet = subnets[i];
      // This should never happen, but just in case
      if (!subnet) {
        context.stderr.write(pc.red(`Error: No subnet found at index ${i}.`));
        throw new Error(`No subnet found at index ${i}.`);
      }

      const asg = subnet.asg;
      const natIp = subnet.nat_ip;

      context.stdout.write(
        `1.b.${i + 1}.a. Running test for subnet: ${subnet.subnet}...\n`
      );

      // Step 1: Create a test instance
      context.stdout.write(`1.b.${i + 1}.b. Scaling ASG ${asg} to 1...\n`);
      scaleAsg({
        asgName: asg,
        awsProfile,
        awsRegion: moduleOutputs.test_config.value.region,
        context,
        desiredCapacity: 1,
        verbose,
      });

      // Step 2: Get the instance id
      const instanceId = await getInstanceId({
        asgName: asg,
        awsProfile,
        awsRegion: moduleOutputs.test_config.value.region,
        context,
        verbose,
      });

      context.stdout.write(`1.b.${i + 1}.c. Instance ID: ${instanceId}\n`);
      context.stdout.write(
        `1.b.${i + 1}.d. Executing network test on ${instanceId}...\n`
      );

      // Step 3: Run the network test
      const commandId = await runSsmCommand({
        instanceId,
        awsProfile,
        awsRegion: moduleOutputs.test_config.value.region,
        context,
        verbose,
      });

      // Step 4: Get the result of the network test
      const publicIp = await getSsmCommandOutput({
        commandId,
        instanceId,
        awsProfile,
        awsRegion: moduleOutputs.test_config.value.region,
        context,
        verbose,
      });

      context.stdout.write(
        `1.b.${i + 1}.e. Public IP for instance ${instanceId}: ${publicIp}\n`
      );

      // Step 5: Ensure the public IP is correct
      if (publicIp !== natIp) {
        context.stderr.write(
          pc.red(`${instanceId} is NOT connecting through NAT!\n`)
        );
        throw new Error("Public IP does not match NAT IP");
      }

      // Step 6: Ensure that the NAT_IP rejects inbound traffic
      await testVpcNetworkBlocking({
        natIp,
        context,
        verbose,
      });

      context.stdout.write(
        pc.green(`Test completed successfully for ${subnet.subnet}.\n`)
      );
      context.stdout.write(
        "-----------------------------------------------------\n"
      );
    }
  } finally {
    // scale down all ASGs no matter what
    for (let i = 0; i < numberOfSubnets; i++) {
      const subnet = subnets[i];
      if (!subnet) {
        continue;
      }
      scaleAsg({
        asgName: subnet.asg,
        awsProfile,
        awsRegion: moduleOutputs.test_config.value.region,
        context,
        desiredCapacity: 0,
        verbose,
      });
    }
  }
};
