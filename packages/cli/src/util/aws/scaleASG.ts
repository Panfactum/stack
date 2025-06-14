import { UpdateAutoScalingGroupCommand } from "@aws-sdk/client-auto-scaling";
import { getAutoScalingClient } from "./clients/getAutoScalingClient";
import { CLIError } from "../error/error";
import type { PanfactumContext } from "@/util/context/context";

export async function scaleASG({
  asgName,
  awsProfile,
  awsRegion,
  context,
  desiredCapacity
}: {
  asgName: string;
  awsProfile: string;
  awsRegion: string;
  context: PanfactumContext;
  desiredCapacity: number;
}) {
  try {
    const client = await getAutoScalingClient({ 
      context, 
      profile: awsProfile, 
      region: awsRegion 
    });

    await client.send(new UpdateAutoScalingGroupCommand({
      AutoScalingGroupName: asgName,
      DesiredCapacity: desiredCapacity
    }));

    context.logger.debug(`Successfully scaled ASG ${asgName} to ${desiredCapacity} instances`);
    return true;
  } catch (error) {
    throw new CLIError(`Failed to scale ASG ${asgName}`, { cause: error });
  }
}
