import { GetCommandInvocationCommand } from "@aws-sdk/client-ssm";
import { CLISubprocessError, CLIError } from "@/util/error/error";
import { getSSMClient } from "./clients/getSSMClient";
import type { PanfactumContext } from "@/util/context/context";

interface Inputs {
  commandId: string;
  instanceId: string;
  awsProfile: string;
  awsRegion: string;
  context: PanfactumContext;
}

/**
 * Get the output from an SSM command execution
 * Checks command status first, and if failed, throws error with stderr content
 */
export const getSSMCommandOutput = async (inputs: Inputs): Promise<string> => {
  const result = await getSSMCommandInvocation(inputs);

  if (result.Status === "Failed") {
    throw new CLISubprocessError(`SSM command on remote instance failed`, {
      command: `SSM command ${inputs.commandId} on instance ${inputs.instanceId}`,
      subprocessLogs: result.StandardErrorContent || "No error details available",
      workingDirectory: process.cwd(),
    });
  }

  return result.StandardOutputContent || "";
};

/**
 * Get the complete SSM command invocation details
 * Uses retry logic to wait for command completion
 */
async function getSSMCommandInvocation(inputs: Inputs) {
  const { awsRegion, awsProfile, instanceId, commandId, context } = inputs;
  
  let retries = 0;
  const maxRetries = 30;  // 30 seconds total timeout
  const retryDelay = 1000; // 1 second between retries

  const ssmClient = await getSSMClient({
    context,
    profile: awsProfile,
    region: awsRegion
  });

  while (retries < maxRetries) {
    try {
      const result = await ssmClient.send(new GetCommandInvocationCommand({
        InstanceId: instanceId,
        CommandId: commandId
      }));

      // Check if command is still running
      if (result.Status === "InProgress" || result.Status === "Pending") {
        // Command is still running, will retry
      } else {
        // Command completed (Success, Failed, Cancelled, etc.)
        return {
          Status: result.Status || "Unknown",
          StandardOutputContent: result.StandardOutputContent || "",
          StandardErrorContent: result.StandardErrorContent || ""
        };
      }
    } catch (error) {
      throw new CLIError(
        `Failed to get SSM command invocation for command ${commandId} on instance ${instanceId}`,
        { cause: error }
      );
    }

    retries++;
    
    // Wait before next retry if we haven't reached max retries
    if (retries < maxRetries) {
      await Bun.sleep(retryDelay);
    }
  }

  throw new CLIError(`SSM command ${commandId} did not complete within timeout`);
}
