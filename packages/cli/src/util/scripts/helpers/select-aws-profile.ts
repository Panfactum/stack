import { search } from "@inquirer/prompts";
import pc from "picocolors";
import type { BaseContext } from "clipanion";

export const selectAwsProfile = async ({
  awsConfigFilePath,
  context,
  message,
}: {
  awsConfigFilePath: string;
  context: BaseContext;
  message: string;
}) => {
  const awsConfig = Bun.file(awsConfigFilePath);
  const awsConfigText = await awsConfig.text();
  const awsProfiles =
    awsConfigText
      .match(/^\[profile (.*)\]$/gm)
      ?.map((profile) => profile.replace(/^\[profile (.*)]\$/, "$1")) || [];

  if (awsProfiles.length === 0) {
    context.stderr.write(
      pc.red(`Error: No AWS profiles found in ${awsConfigFilePath}.`)
    );
    return undefined;
  }

  // Prompt user to select an aws profile
  const selectedAwsProfile = await search({
    message,
    source: (input) => {
      const awsProfileChoices = awsProfiles.map((profile) => ({
        value: profile,
      }));

      if (!input) {
        return awsProfileChoices;
      }

      return awsProfileChoices.filter((awsProfile) =>
        awsProfile.value.toLowerCase().includes(input.toLowerCase())
      );
    },
  });

  return selectedAwsProfile.replace("[", "").replace("]", "").split(" ")[1];
};
