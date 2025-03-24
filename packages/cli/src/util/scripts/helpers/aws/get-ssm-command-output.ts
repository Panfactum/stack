import type { BaseContext } from "clipanion";

export const getSsmCommandOutput = async ({
  commandId,
  instanceId,
  awsProfile,
  awsRegion,
  context,
  verbose = false,
}: {
  commandId: string;
  instanceId: string;
  awsProfile: string;
  awsRegion: string;
  context: BaseContext;
  verbose?: boolean;
}): Promise<string> => {
  let status = "";

  if (verbose) {
    context.stdout.write("AWS Region: " + awsRegion + "\n");
    context.stdout.write("AWS Profile: " + awsProfile + "\n");
    context.stdout.write("Instance ID: " + instanceId + "\n");
    context.stdout.write("Command ID: " + commandId + "\n");
  }

  while (true) {
    context.stdout.write("Waiting for test to complete...\n");
    const process = Bun.spawnSync(
      [
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
      {
        stdout: "pipe",
        stderr: "pipe",
      }
    );

    if (verbose) {
      context.stdout.write(
        "getSsmCommandOutput STDOUT: " +
          (process.stdout?.toString() ?? "") +
          "\n"
      );
      context.stderr.write(
        "getSsmCommandOutput STDERR: " +
          (process.stderr?.toString() ?? "") +
          "\n"
      );
    }

    status = process.stdout.toString().trim();

    if (status === "Success" || status === "Failed") {
      break;
    }

    // Wait 5 seconds before trying again
    await new Promise((resolve) => {
      globalThis.setTimeout(resolve, 5000);
    });
  }

  if (status === "Failed") {
    const process = Bun.spawnSync(
      [
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
      {
        stdout: "pipe",
        stderr: "ignore",
      }
    );

    if (verbose) {
      context.stdout.write(
        "getSsmCommandOutput FailedSTDOUT: " +
          (process.stdout?.toString() ?? "") +
          "\n"
      );
    }

    const error = process.stdout.toString().trim();
    context.stderr.write(`Test failed: ${error}\n`);
    throw new Error("Failed to execute SSM command after multiple retries");
  }

  const process = Bun.spawnSync(
    [
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
    {
      stdout: "pipe",
      stderr: "ignore",
    }
  );

  if (verbose) {
    context.stdout.write(
      "getSsmCommandOutput Success STDOUT: " +
        (process.stdout?.toString() ?? "") +
        "\n"
    );
  }

  const output = process.stdout.toString().trim();

  return output;
};
