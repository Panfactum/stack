import { progressMessage } from "../../../progress-message";
import type { BaseContext } from "clipanion";

export async function getInstanceId({
  asgName,
  awsProfile,
  awsRegion,
  context,
  verbose = false,
}: {
  asgName: string;
  awsProfile: string;
  awsRegion: string;
  context: BaseContext;
  verbose?: boolean;
}) {
  let instanceId: string | null = null;
  const instanceIdProgress = progressMessage({
    context,
    message: "Waiting for instance to be created",
    interval: 10000,
  });

  while (!instanceId || instanceId === "None" || instanceId === "") {
    // Wait for 10 seconds
    await new Promise((resolve) => globalThis.setTimeout(resolve, 10000));

    const result = Bun.spawnSync(
      [
        "aws",
        "--region",
        awsRegion,
        "--profile",
        awsProfile,
        "autoscaling",
        "describe-auto-scaling-groups",
        "--auto-scaling-group-names",
        asgName,
        "--query",
        "AutoScalingGroups[0].Instances[0].InstanceId",
        "--output",
        "text",
      ],
      {
        encoding: "utf-8",
        stdout: "pipe",
      }
    );

    if (verbose) {
      context.stdout.write(
        "getInstanceId STDOUT: " + (result.stdout?.toString() ?? "") + "\n"
      );
      context.stderr.write(
        "getInstanceId STDERR: " + (result.stderr?.toString() ?? "") + "\n"
      );
    }

    instanceId = result.stdout.toString().trim();
  }

  globalThis.clearInterval(instanceIdProgress);
  context.stdout.write("\n");

  return instanceId;
}
