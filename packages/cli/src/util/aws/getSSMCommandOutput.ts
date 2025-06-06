import { GetCommandInvocationCommand } from "@aws-sdk/client-ssm";
import { CLISubprocessError, CLIError } from "../error/error";
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
  const maxRetries = 60;

  while (retries < maxRetries) {
    try {
      const ssmClient = await getSSMClient({
        context,
        profile: awsProfile,
        region: awsRegion
      });

      const result = await ssmClient.send(new GetCommandInvocationCommand({
        InstanceId: instanceId,
        CommandId: commandId
      }));

      // Check if command is still running
      if (result.Status === "InProgress" || result.Status === "Pending") {
        if (retries < maxRetries - 1) {
          await new Promise(resolve => globalThis.setTimeout(resolve, 1000));
          retries++;
          continue;
        } else {
          throw new CLIError(`SSM command ${commandId} did not complete within timeout`);
        }
      }

      // Command completed (Success, Failed, Cancelled, etc.)
      return {
        Status: result.Status || "Unknown",
        StandardOutputContent: result.StandardOutputContent || "",
        StandardErrorContent: result.StandardErrorContent || ""
      };
    } catch (error) {
      if (retries < maxRetries - 1) {
        await new Promise(resolve => globalThis.setTimeout(resolve, 1000));
        retries++;
      } else {
        throw new CLIError(
          `Failed to get SSM command invocation for command ${commandId} on instance ${instanceId}`,
          { cause: error }
        );
      }
    }
  }

  throw new CLIError(`Failed to get SSM command invocation after ${maxRetries} retries`);
}
