import { setTimeout } from "node:timers/promises";
import { DescribeAutoScalingGroupsCommand } from "@aws-sdk/client-auto-scaling";
import { getAutoScalingClient } from "@/util/aws/clients/getAutoScalingClient.ts";
import { CLIError } from "@/util/error/error";
import type { PanfactumContext } from "@/util/context/context.ts";

/**
 * Wait for an instance to be created in an Auto Scaling Group
 */
export async function waitForASGInstance(
  asg: string,
  awsProfile: string,
  awsRegion: string,
  context: PanfactumContext
): Promise<string> {
  let retries = 0;
  const maxRetries = 10;
  const retryDelay = 10000;

  const client = await getAutoScalingClient({
    context,
    profile: awsProfile,
    region: awsRegion
  });

  while (retries < maxRetries) {
    try {
      const result = await client.send(new DescribeAutoScalingGroupsCommand({
        AutoScalingGroupNames: [asg]
      }));

      const instance = result.AutoScalingGroups?.[0]?.Instances?.[0];
      if (instance?.InstanceId) {
        return instance.InstanceId;
      }
    } catch (error) {
      throw new CLIError("Failed to get instance ID", { cause: error });
    }

    retries++;
    
    // Wait before next retry if we haven't reached max retries
    if (retries < maxRetries) {
      await setTimeout(retryDelay);
    }
  }
  
  throw new CLIError("Failed to get instance ID - no instances found in ASG");
}