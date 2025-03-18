import { progressMessage } from "../../../progress-message";
import type { BaseContext } from "clipanion";

export async function getInstanceId({
  asgName,
  awsProfile,
  awsRegion,
  context,
}: {
  asgName: string;
  awsProfile: string;
  awsRegion: string;
  context: BaseContext;
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

    instanceId = result.stdout.toString().trim();
  }

  globalThis.clearInterval(instanceIdProgress);

  return instanceId;
}
