// This file provides utilities for detecting scaling failures in Auto Scaling Groups
// It checks for capacity-related errors and throws descriptive errors when failures are detected

import { DescribeScalingActivitiesCommand } from "@aws-sdk/client-auto-scaling";
import { getAutoScalingClient } from "@/util/aws/clients/getAutoScalingClient";
import { CLIError } from "@/util/error/error";
import type { PanfactumContext } from "@/util/context/context";
import type { DescribeScalingActivitiesCommandOutput } from "@aws-sdk/client-auto-scaling";

/**
 * Input parameters for checking ASG scaling failure
 */
interface ICheckASGScalingFailureInput {
  /** Auto Scaling Group name to check */
  asg: string;
  /** AWS profile to use for authentication */
  awsProfile: string;
  /** AWS region where the ASG is located */
  awsRegion: string;
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
}

/**
 * Checks an ASG's most recent scaling activity for capacity failures and throws a descriptive error if one is detected
 *
 * @remarks
 * This function retrieves only the most recent scaling activity for the given Auto Scaling Group
 * and inspects it for failure status. When a failure is detected, it distinguishes between
 * capacity-related failures (insufficient EC2 capacity in the availability zone) and other
 * generic scaling failures, providing an appropriate actionable error message for each case.
 *
 * If no scaling activities exist, or if the most recent activity has not failed, the function
 * returns silently without throwing.
 *
 * @param input - Configuration including ASG name, AWS credentials, and Panfactum context
 * @returns Resolves with void when no failure is detected
 *
 * @example
 * ```typescript
 * // Check for scaling failures before proceeding
 * await checkASGScalingFailure({
 *   asg: 'my-app-asg',
 *   awsProfile: 'production',
 *   awsRegion: 'us-east-1',
 *   context
 * });
 * ```
 *
 * @throws {@link CLIError}
 * Throws when the most recent scaling activity failed due to insufficient EC2 capacity,
 * including guidance to wait or try a different region.
 *
 * @throws {@link CLIError}
 * Throws when the most recent scaling activity failed for a non-capacity reason,
 * including the AWS status message for diagnosis.
 *
 * @see {@link getAutoScalingClient} - For Auto Scaling client creation
 * @see {@link DescribeScalingActivitiesCommand} - AWS SDK command used to retrieve activities
 */
export async function checkASGScalingFailure(input: ICheckASGScalingFailureInput): Promise<void> {
  const { asg, awsProfile, awsRegion, context } = input;

  const client = await getAutoScalingClient({
    context,
    profile: awsProfile,
    region: awsRegion
  });

  let result: DescribeScalingActivitiesCommandOutput;
  try {
    result = await client.send(new DescribeScalingActivitiesCommand({
      AutoScalingGroupName: asg,
      MaxRecords: 1
    }));
  } catch (error) {
    throw new CLIError(`Failed to describe scaling activities for ASG ${asg}`, error);
  }

  const activities = result.Activities;

  if (!activities || activities.length === 0) {
    return;
  }

  const latestActivity = activities[0];

  if (latestActivity?.StatusCode !== "Failed") {
    return;
  }

  const statusMessage = latestActivity.StatusMessage ?? "";
  const lowerMessage = statusMessage.toLowerCase();

  const isCapacityError =
    lowerMessage.includes("insufficient capacity") ||
    lowerMessage.includes("not have sufficient") ||
    lowerMessage.includes("could not find enough available capacity");

  if (isCapacityError) {
    throw new CLIError([
      `ASG ${asg} scaling activity failed due to insufficient EC2 capacity.`,
      `AWS status: ${statusMessage}`,
      `AWS does not have enough capacity to launch instances in this availability zone. Wait a few minutes and try again, or try a different region.`
    ]);
  }

  throw new CLIError([
    `ASG ${asg} scaling activity failed.`,
    `AWS status: ${statusMessage}`
  ]);
}
