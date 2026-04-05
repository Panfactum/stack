// This file provides utilities for waiting for EC2 instances in Auto Scaling Groups
// It polls ASG state until an instance becomes available

import { DescribeAutoScalingGroupsCommand } from "@aws-sdk/client-auto-scaling";
import { checkASGScalingFailure } from "@/util/aws/checkASGScalingFailure";
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
  /** Maximum number of retry attempts (default: 180, which is 30 minutes at 10s intervals) */
  maxRetries?: number;
}

/**
 * Waits for an instance to be created in an Auto Scaling Group
 *
 * @remarks
 * This function polls an Auto Scaling Group until at least one instance
 * is running. It's typically used after scaling operations to wait for
 * new instances to become available. The function polls every 10 seconds
 * for up to 30 minutes by default (180 retries at 10s intervals).
 *
 * On each poll iteration where no instance is found, `checkASGScalingFailure`
 * is called to detect capacity-related errors early and fail fast instead of
 * waiting the full timeout duration.
 *
 * @param input - Configuration including ASG name, AWS credentials, and optional maxRetries
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
 * Throws when no instance is available after the configured number of retry attempts
 *
 * @throws {@link CLIError}
 * Throws when a scaling activity fails due to insufficient EC2 capacity,
 * as detected by {@link checkASGScalingFailure}
 *
 * @see {@link getAutoScalingClient} - For Auto Scaling client creation
 * @see {@link checkASGScalingFailure} - For scaling failure detection
 * @see {@link scaleASG} - For scaling Auto Scaling Groups
 */
export async function waitForASGInstance(input: IWaitForASGInstanceInput): Promise<string> {
  const { asg, awsProfile, awsRegion, context } = input;
  let retries = 0;
  const resolvedMaxRetries = input.maxRetries ?? 180;
  const retryDelay = 10000;

  const client = await getAutoScalingClient({
    context,
    profile: awsProfile,
    region: awsRegion
  });

  while (retries < resolvedMaxRetries) {
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

    // Check for scaling failures (e.g., capacity exhaustion) before retrying
    await checkASGScalingFailure({ asg, awsProfile, awsRegion, context });

    retries++;

    if (retries < resolvedMaxRetries) {
      await sleep(retryDelay);
    }
  }

  throw new CLIError(`Failed to get instance ID - after ${resolvedMaxRetries} retries`);
}
