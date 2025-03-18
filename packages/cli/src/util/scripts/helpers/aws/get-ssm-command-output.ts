import type { BaseContext } from "clipanion";

export const getSsmCommandOutput = async ({
  commandId,
  instanceId,
  awsProfile,
  awsRegion,
  context,
}: {
  commandId: string;
  instanceId: string;
  awsProfile: string;
  awsRegion: string;
  context: BaseContext;
}): Promise<string> => {
  let status = "";

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
        stderr: "ignore",
      }
    );

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

    const error = process.stdout.toString().trim();
    context.stderr.write(`\tTest failed: ${error}\n`);
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

  return process.stdout.toString().trim();
};
