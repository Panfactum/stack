export function scaleAsg({
  asgName,
  awsProfile,
  awsRegion,
  desiredCapacity,
  verbose = false,
}: {
  asgName: string;
  awsProfile: string;
  awsRegion: string;
  desiredCapacity: number;
  verbose?: boolean;
}) {
  Bun.spawn(
    [
      "aws",
      "autoscaling",
      "update-auto-scaling-group",
      "--auto-scaling-group-name",
      asgName,
      "--desired-capacity",
      desiredCapacity.toString(),
      "--region",
      awsRegion,
      "--profile",
      awsProfile,
    ],
    {
      stdout: verbose ? "inherit" : "ignore",
      stderr: "pipe",
    }
  );
}
