import type { BaseContext } from "clipanion";

export const runSsmCommand = async ({
  instanceId,
  awsProfile,
  awsRegion,
  context,
}: {
  instanceId: string;
  awsProfile: string;
  awsRegion: string;
  context: BaseContext;
}): Promise<string> => {
  let commandId = "";
  const retries = 20;

  for (let i = 1; i <= retries; i++) {
    const process = Bun.spawnSync(
      [
        "aws",
        "--region",
        awsRegion,
        "--profile",
        awsProfile,
        "ssm",
        "send-command",
        "--instance-ids",
        instanceId,
        "--document-name",
        "AWS-RunShellScript",
        "--comment",
        "Get Public IP",
        "--parameters",
        'commands=["curl -m 10 ifconfig.me"]',
        "--query",
        "Command.CommandId",
        "--output",
        "text",
      ],
      {
        stdout: "pipe",
        stderr: "ignore",
      }
    );

    commandId = process.stdout.toString().trim();

    if (!commandId) {
      context.stdout.write("\tTest started.\n");
      context.stdout.write(commandId);
      return commandId;
    } else {
      context.stdout.write(
        `\tWaiting for instance ${instanceId} to become ready...\n`
      );
    }

    // Wait 5 seconds before trying again
    await new Promise((resolve) => {
      globalThis.setTimeout(resolve, 5000);
    });
  }

  // If we get here, we've exceeded our retries
  context.stderr.write("\tTimeout exceeded. Failed to execute test!\n");
  throw new Error("Failed to execute SSM command after multiple retries");
};
