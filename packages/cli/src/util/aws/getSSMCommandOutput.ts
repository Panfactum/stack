// This file provides utilities for retrieving AWS Systems Manager command output
// It handles polling for command completion and error reporting

import { GetCommandInvocationCommand } from "@aws-sdk/client-ssm";
import { CLISubprocessError, CLIError } from "@/util/error/error";
import { getSSMClient } from "./clients/getSSMClient";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for getting SSM command output
 */
interface IGetSSMCommandOutputInput {
  /** SSM command ID to retrieve output for */
  commandId: string;
  /** EC2 instance ID where the command was executed */
  instanceId: string;
  /** AWS profile to use for authentication */
  awsProfile: string;
  /** AWS region where the command was executed */
  awsRegion: string;
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
}

/**
 * Retrieves the output from an SSM command execution
 * 
 * @remarks
 * This function polls AWS Systems Manager for command completion status
 * and returns the standard output. If the command fails, it throws an
 * error with the standard error content. The function handles polling
 * with retry logic to wait for command completion.
 * 
 * @param inputs - Configuration including command ID, instance ID, and AWS credentials
 * @returns Standard output content from the command execution
 * 
 * @example
 * ```typescript
 * const output = await getSSMCommandOutput({
 *   commandId: 'cmd-12345',
 *   instanceId: 'i-0123456789abcdef0',
 *   awsProfile: 'production',
 *   awsRegion: 'us-east-1',
 *   context
 * });
 * console.log('Command output:', output);
 * ```
 * 
 * @throws {@link CLISubprocessError}
 * Throws when the SSM command execution fails with stderr content
 * 
 * @throws {@link CLIError}
 * Throws when unable to retrieve command invocation details
 * 
 * @throws {@link CLIError}
 * Throws when command doesn't complete within 30 second timeout
 * 
 * @see {@link getSSMClient} - For SSM client creation
 * @see {@link sendSSMCommand} - For sending SSM commands
 */
export const getSSMCommandOutput = async (inputs: IGetSSMCommandOutputInput): Promise<string> => {
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
 * Internal SSM command invocation result
 */
interface ISSMCommandInvocationResult {
  /** Command execution status */
  Status: string;
  /** Standard output content */
  StandardOutputContent: string;
  /** Standard error content */
  StandardErrorContent: string;
}

/**
 * Gets the complete SSM command invocation details with retry logic
 * 
 * @internal
 * @param inputs - Configuration for retrieving command details
 * @returns Command execution status and output/error content
 */
async function getSSMCommandInvocation(inputs: IGetSSMCommandOutputInput): Promise<ISSMCommandInvocationResult> {
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
