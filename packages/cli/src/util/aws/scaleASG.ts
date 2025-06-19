import { UpdateAutoScalingGroupCommand } from "@aws-sdk/client-auto-scaling";
import { getAutoScalingClient } from "./clients/getAutoScalingClient";
import { CLIError } from "../error/error";
import type { PanfactumContext } from "@/util/context/context";

export async function scaleASG({
  asgName,
  awsProfile,
  awsRegion,
  context,
  desiredCapacity,
  minSize,
  maxSize
}: {
  asgName: string;
  awsProfile: string;
  awsRegion: string;
  context: PanfactumContext;
  desiredCapacity?: number;
  minSize?: number;
  maxSize?: number;
}) {
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
