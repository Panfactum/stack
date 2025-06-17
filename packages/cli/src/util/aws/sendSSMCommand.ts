import { setTimeout } from "node:timers/promises";
import { SendCommandCommand } from "@aws-sdk/client-ssm";
import { getSSMClient } from "@/util/aws/clients/getSSMClient.ts";
import { CLIError } from "@/util/error/error";
import type { PanfactumContext } from "@/util/context/context.ts";

/**
 * Send an SSM command to an instance with retry logic
 */
export async function sendSSMCommand(
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
        await setTimeout(1000);
        ssmRetries++;
      } else {
        throw new CLIError("Failed to execute SSM command", { cause: error });
      }
    }
  }
  
  throw new CLIError("Failed to execute SSM command after all retries");
}