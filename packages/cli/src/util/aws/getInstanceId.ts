import { execute } from "../subprocess/execute";
import type { PanfactumContext } from "@/context/context";

export async function getInstanceId({
  asgName,
  awsProfile,
  awsRegion,
  context
}: {
  asgName: string;
  awsProfile: string;
  awsRegion: string;
  context: PanfactumContext;
}) {

  const workingDirectory = process.cwd()
  const {stdout} = await execute({
    command: [
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
    context,
    workingDirectory,
    errorMessage: "Failed to get instance ID",
    retries: 10,
    retryDelay: 10000,
    isSuccess({stdout}) {
      return stdout !== "None" && stdout !== ""
    },
  })

  return stdout;
}
