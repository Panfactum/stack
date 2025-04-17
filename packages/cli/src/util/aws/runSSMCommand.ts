import { execute } from "../subprocess/execute";
import type { PanfactumContext } from "@/context/context";

export const runSsmCommand = async ({
  instanceId,
  awsProfile,
  awsRegion,
  context
}: {
  instanceId: string;
  awsProfile: string;
  awsRegion: string;
  context: PanfactumContext;
}): Promise<string> => {

  const {stdout} = await execute({
    command: [
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
    context,
    workingDirectory: process.cwd(),
    errorMessage: `Failed to execute SSM command`,
    retries: 20
  })
  return stdout
};
