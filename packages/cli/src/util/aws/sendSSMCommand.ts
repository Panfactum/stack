// This file provides utilities for sending AWS Systems Manager commands to EC2 instances
// It includes retry logic for handling transient failures

import { SendCommandCommand } from "@aws-sdk/client-ssm";
import { getSSMClient } from "@/util/aws/clients/getSSMClient.ts";
import { CLIError } from "@/util/error/error";
import type { PanfactumContext } from "@/util/context/context.ts";

/**
 * Input parameters for sending an SSM command
 */
interface ISendSSMCommandInput {
  /** EC2 instance ID to send the command to */
  instanceId: string;
  /** AWS profile to use for authentication */
  awsProfile: string;
  /** AWS region where the instance is located */
  awsRegion: string;
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
}

/**
 * Sends an SSM command to retrieve the public IP of an EC2 instance
 * 
 * @remarks
 * This function sends a shell command via AWS Systems Manager to determine
 * the public IP address of an EC2 instance. It uses the 'ifconfig.me' service
 * to retrieve the external IP. The function includes retry logic with up to
 * 20 attempts to handle transient SSM connectivity issues.
 * 
 * @param input - Configuration including instance ID and AWS credentials
 * @returns SSM command ID for tracking command execution
 * 
 * @example
 * ```typescript
 * const commandId = await sendSSMCommand({
 *   instanceId: 'i-0123456789abcdef0',
 *   awsProfile: 'production',
 *   awsRegion: 'us-east-1',
 *   context
 * });
 * console.log(`Command sent with ID: ${commandId}`);
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when no command ID is returned from SSM
 * 
 * @throws {@link CLIError}
 * Throws when SSM command fails after all retry attempts
 * 
 * @see {@link getSSMClient} - For SSM client creation
 * @see {@link getSSMCommandOutput} - For retrieving command results
 */
export async function sendSSMCommand(input: ISendSSMCommandInput): Promise<string> {
  const { instanceId, awsProfile, awsRegion, context } = input;
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
        await Bun.sleep(1000);
        ssmRetries++;
      } else {
        throw new CLIError("Failed to execute SSM command", { cause: error });
      }
    }
  }
  
  throw new CLIError("Failed to execute SSM command after all retries");
}