import type { BaseContext } from "clipanion";

export function scaleAsg({
  asgName,
  awsProfile,
  awsRegion,
  context,
  desiredCapacity,
  verbose = false,
}: {
  asgName: string;
  awsProfile: string;
  awsRegion: string;
  context: BaseContext;
  desiredCapacity: number;
  verbose?: boolean;
}) {
  const result = Bun.spawnSync(
    [
      "aws",
      "--region",
      awsRegion,
      "--profile",
      awsProfile,
      "autoscaling",
      "update-auto-scaling-group",
      "--auto-scaling-group-name",
      asgName,
      "--desired-capacity",
      desiredCapacity.toString(),
    ],
    {
      stdout: verbose ? "pipe" : "ignore",
      stderr: "pipe",
    }
  );

  if (verbose) {
    context.stdout.write(
      "scaleAsg STDOUT: " + (result.stdout?.toString() ?? "") + "\n"
    );
    context.stderr.write(
      "scaleAsg STDERR: " + (result.stderr?.toString() ?? "") + "\n"
    );
  }
}
