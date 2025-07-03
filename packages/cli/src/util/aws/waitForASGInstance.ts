// This file provides utilities for waiting for EC2 instances in Auto Scaling Groups
// It polls ASG state until an instance becomes available

import { DescribeAutoScalingGroupsCommand } from "@aws-sdk/client-auto-scaling";
import { getAutoScalingClient } from "@/util/aws/clients/getAutoScalingClient.ts";
import { CLIError } from "@/util/error/error";
import { sleep } from "@/util/util/sleep";
import type { PanfactumContext } from "@/util/context/context.ts";

/**
 * Input parameters for waiting for an ASG instance
 */
interface IWaitForASGInstanceInput {
  /** Auto Scaling Group name to monitor */
  asg: string;
  /** AWS profile to use for authentication */
  awsProfile: string;
  /** AWS region where the ASG is located */
  awsRegion: string;
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
}

/**
 * Waits for an instance to be created in an Auto Scaling Group
 * 
 * @remarks
 * This function polls an Auto Scaling Group until at least one instance
 * is running. It's typically used after scaling operations to wait for
 * new instances to become available. The function polls every 10 seconds
 * for up to 100 seconds total.
 * 
 * @param input - Configuration including ASG name and AWS credentials
 * @returns Instance ID of the first available instance in the ASG
 * 
 * @example
 * ```typescript
 * const instanceId = await waitForASGInstance({
 *   asg: 'my-app-asg',
 *   awsProfile: 'production',
 *   awsRegion: 'us-east-1',
 *   context
 * });
 * console.log(`Instance ${instanceId} is now available`);
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when unable to describe the Auto Scaling Group
 * 
 * @throws {@link CLIError}
 * Throws when no instance is available after 10 retry attempts
 * 
 * @see {@link getAutoScalingClient} - For Auto Scaling client creation
 * @see {@link scaleASG} - For scaling Auto Scaling Groups
 */
export async function waitForASGInstance(input: IWaitForASGInstanceInput): Promise<string> {
  const { asg, awsProfile, awsRegion, context } = input;
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
      await sleep(retryDelay);
    }
  }
  
  throw new CLIError(`Failed to get instance ID - after ${maxRetries} retries`);
}