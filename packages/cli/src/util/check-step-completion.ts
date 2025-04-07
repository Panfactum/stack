import pc from "picocolors";
import { getConfigFileKey } from "./get-config-file-key";
import { printHelpInformation } from "./print-help-information";
import type { BaseContext } from "clipanion";

export async function checkStepCompletion({
  configFilePath,
  context,
  step,
  stepCompleteMessage,
  stepNotCompleteMessage,
}: {
  configFilePath: string;
  context: BaseContext;
  step: string;
  stepCompleteMessage: string;
  stepNotCompleteMessage: string;
}): Promise<boolean> {
  const stepComplete = await getConfigFileKey({
    key: step,
    configPath: configFilePath,
    context,
  });

  if (
    typeof stepComplete !== "boolean" &&
    typeof stepComplete !== "undefined"
  ) {
    context.stderr.write(
      pc.red(
        `Step ${step} is not a boolean: ${JSON.stringify(stepComplete, null, 2)}\n`
      )
    );
    printHelpInformation(context);
    throw new Error(`Failed to check step completion.`);
  }

  if (stepComplete === true) {
    context.stdout.write(`${stepCompleteMessage}\n`);
  } else {
    context.stdout.write(`${stepNotCompleteMessage}\n`);
  }

  return !!stepComplete;
}
