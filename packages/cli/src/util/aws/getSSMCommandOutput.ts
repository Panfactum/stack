import { CLISubprocessError } from "../error/error";
import { execute } from "../subprocess/execute";
import type { PanfactumContext } from "@/util/context/context";

interface Inputs {
  commandId: string;
  instanceId: string;
  awsProfile: string;
  awsRegion: string;
  context: PanfactumContext;
}

export const getSSMCommandOutput = async (inputs: Inputs): Promise<string> => {
  const workingDirectory = process.cwd();
  const status = await getSSMCommandStatus({ ...inputs, workingDirectory });

  if (status === "Failed") {
    await getSSMCommandStdErr({ ...inputs, workingDirectory });
  }

  return getSSMCommandStdOut({ ...inputs, workingDirectory });
};

async function getSSMCommandStdOut(
  inputs: Inputs & { workingDirectory: string }
) {
  const {
    awsRegion,
    awsProfile,
    instanceId,
    commandId,
    context,
    workingDirectory
  } = inputs;

  const { stdout } = await execute({
    command: [
      "aws",
      "--region",
      awsRegion,
      "--profile",
      awsProfile,
      "ssm",
      "get-command-invocation",
      "--instance-id",
      instanceId,
      "--command-id",
      commandId,
      "--query",
      "StandardOutputContent",
      "--output",
      "text",
    ],
    context,
    workingDirectory,
    errorMessage: `Failed to get stdout from SSM command ${commandId} on instance ${instanceId}`
  });

  return stdout;
}

async function getSSMCommandStdErr(
  inputs: Inputs & { workingDirectory: string }
) {
  const {
    awsRegion,
    awsProfile,
    instanceId,
    commandId,
    context,
    workingDirectory,
  } = inputs;

  const { stdout } = await execute({
    command: [
      "aws",
      "--region",
      awsRegion,
      "--profile",
      awsProfile,
      "ssm",
      "get-command-invocation",
      "--instance-id",
      instanceId,
      "--command-id",
      commandId,
      "--query",
      "StandardErrorContent",
      "--output",
      "text",
    ],
    context,
    workingDirectory,
    errorMessage: `Failed to get stderr from SSM command ${commandId} on instance ${instanceId}`
  });

  throw new CLISubprocessError(`SSM command on remote instance failed`, {
    command: `SSM command ${commandId} on instance ${instanceId}`,
    subprocessLogs: stdout,
    workingDirectory,
  });
}

async function getSSMCommandStatus(
  inputs: Inputs & { workingDirectory: string }
) {
  const {
    awsRegion,
    awsProfile,
    instanceId,
    commandId,
    context,
    workingDirectory
  } = inputs;

  const { stdout } = await execute({
    command: [
      "aws",
      "--region",
      awsRegion,
      "--profile",
      awsProfile,
      "ssm",
      "get-command-invocation",
      "--instance-id",
      instanceId,
      "--command-id",
      commandId,
      "--query",
      "Status",
      "--output",
      "text",
    ],
    context,
    workingDirectory,
    errorMessage: `Failed to get SSM command status for command ${commandId} on instance ${instanceId}`,
    retries: 60,
    isSuccess: ({ stdout, exitCode }) =>
      exitCode === 0 && (stdout === "Success" || stdout === "Failed")
  });
  return stdout;
}
