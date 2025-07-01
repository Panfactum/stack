// This file provides utilities for scaling AWS Auto Scaling Groups
// It handles capacity adjustments for EC2 instance groups

import { UpdateAutoScalingGroupCommand } from "@aws-sdk/client-auto-scaling";
import { getAutoScalingClient } from "./clients/getAutoScalingClient";
import { CLIError } from "../error/error";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for scaling an Auto Scaling Group
 */
interface IScaleASGInput {
  /** Name of the Auto Scaling Group to scale */
  asgName: string;
  /** AWS profile to use for authentication */
  awsProfile: string;
  /** AWS region where the ASG is located */
  awsRegion: string;
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** Desired number of instances (optional) */
  desiredCapacity?: number;
  /** Minimum number of instances (optional) */
  minSize?: number;
  /** Maximum number of instances (optional) */
  maxSize?: number;
}

/**
 * Scales an AWS Auto Scaling Group by updating its capacity settings
 * 
 * @remarks
 * This function updates the capacity settings of an Auto Scaling Group,
 * including desired, minimum, and maximum instance counts. Only the
 * parameters provided will be updated; omitted parameters retain their
 * current values. The function is commonly used for manual scaling
 * operations or automated capacity adjustments.
 * 
 * @param input - Configuration including ASG name, AWS credentials, and capacity settings
 * @returns True if the scaling operation succeeded
 * 
 * @example
 * ```typescript
 * // Scale ASG to exactly 5 instances
 * await scaleASG({
 *   asgName: 'production-web-asg',
 *   awsProfile: 'prod',
 *   awsRegion: 'us-east-1',
 *   context,
 *   desiredCapacity: 5,
 *   minSize: 3,
 *   maxSize: 10
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Only update minimum size
 * await scaleASG({
 *   asgName: 'staging-asg',
 *   awsProfile: 'staging',
 *   awsRegion: 'us-west-2',
 *   context,
 *   minSize: 1
 * });
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when unable to update the Auto Scaling Group
 * 
 * @see {@link getAutoScalingClient} - For Auto Scaling client creation
 */
export async function scaleASG(input: IScaleASGInput): Promise<boolean> {
  const {
    asgName,
    awsProfile,
    awsRegion,
    context,
    desiredCapacity,
    minSize,
    maxSize
  } = input;
  
  try {
    const client = await getAutoScalingClient({ 
      context, 
      profile: awsProfile, 
      region: awsRegion 
    });

    const command: {
      AutoScalingGroupName: string;
      DesiredCapacity?: number;
      MinSize?: number;
      MaxSize?: number;
    } = {
      AutoScalingGroupName: asgName
    };

    if (desiredCapacity !== undefined) {
      command.DesiredCapacity = desiredCapacity;
    }
    if (minSize !== undefined) {
      command.MinSize = minSize;
    }
    if (maxSize !== undefined) {
      command.MaxSize = maxSize;
    }

    await client.send(new UpdateAutoScalingGroupCommand(command));

    context.logger.debug(`Successfully updated ASG ${asgName}`);
    return true;
  } catch (error) {
    throw new CLIError(`Failed to update ASG ${asgName}`, error);
  }
}
