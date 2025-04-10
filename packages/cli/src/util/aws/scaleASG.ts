import { execute } from "../subprocess/execute";
import type { PanfactumContext } from "@/context/context";

export async function scaleASG({
  asgName,
  awsProfile,
  awsRegion,
  context,
  desiredCapacity
}: {
  asgName: string;
  awsProfile: string;
  awsRegion: string;
  context: PanfactumContext;
  desiredCapacity: number;
}) {
  await execute({
    command: [
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
    context,
    workingDirectory: process.cwd(),
    errorMessage: `Failed to scale ASG ${asgName}`,
  })
  return true
}
