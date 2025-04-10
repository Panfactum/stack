import { join } from "node:path";
import { writeFile } from "@/util/fs/writeFile";
import { replaceHCLValue } from "@/util/terragrunt/replaceHCLValue";
import { terragruntInitAndApply } from "@/util/terragrunt/terragruntInitAndApply";
import { informStepComplete, informStepStart } from "./messages";
import type { Checkpointer, Step } from "./checkpointer";
import type { PanfactumContext } from "@/context/context";

export async function deployModule({
  clusterPath,
  context,
  moduleDirectory,
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
  clusterPath: string;
  context: PanfactumContext;
  moduleDirectory: string;
  overwrite?: boolean;
  stepName: string;
  stepNum: number;
  subStepNum?: number;
  checkpointer: Checkpointer;
  stepId: Step;
  hclUpdates?: { [path: string]: string | number | boolean };
}) {
  const modulePath = join(clusterPath, moduleDirectory);
  const hclFile = join(modulePath, "terragrunt.hcl");

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

    if (hclUpdates) {
      for (const [inputPath, value] of Object.entries(hclUpdates)) {
        await replaceHCLValue(hclFile, inputPath, value);
      }
    }

    await terragruntInitAndApply({
      context,
      modulePath,
    });

    await checkpointer.setStepComplete(stepId);
  }
}
