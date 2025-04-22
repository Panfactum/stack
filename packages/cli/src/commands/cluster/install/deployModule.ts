import { join } from "node:path";
import { writeFile } from "@/util/fs/writeFile";
import { replaceHCLValue } from "@/util/terragrunt/replaceHCLValue";
import { terragruntInitAndApply } from "@/util/terragrunt/terragruntInitAndApply";
import { informStepComplete, informStepStart } from "./messages";
import type { Checkpointer, Step } from "./checkpointer";
import type { PanfactumContext } from "@/context/context";

export async function deployModule({
  context,
  environment,
  region,
  module,
  overwrite = true,
  stepId,
  stepName,
  stepNum,
  subStepNum,
  checkpointer,
  terraguntContents,
  hclUpdates,
}: {
  terraguntContents?: string;
  context: PanfactumContext;
  overwrite?: boolean;
  stepName: string;
  stepNum: number;
  subStepNum?: number;
  checkpointer: Checkpointer;
  environment: string;
  region: string;
  module: string;
  stepId: Step;
  hclUpdates?: {
    [path: string]: string | boolean | number | string[] | number[] | boolean[];
  };
}) {
  const hclFile = join(context.repoVariables.environments_dir, environment, region, module, "terragrunt.hcl");

  if (await checkpointer.isStepComplete(stepId)) {
    informStepComplete(context, stepName, stepNum, subStepNum);
  } else {
    informStepStart(context, stepName, stepNum, subStepNum);
    if (terraguntContents) {
      await writeFile({
        context,
        path: hclFile,
        contents: await Bun.file(terraguntContents).text(),
        overwrite,
      });
    }

    if (hclUpdates) {
      for (const [inputPath, value] of Object.entries(hclUpdates)) {
        await replaceHCLValue(hclFile, inputPath, value);
      }
    }

    await terragruntInitAndApply({
      context,
      environment,
      region,
      module
    });

    await checkpointer.setStepComplete(stepId);
  }
}
