import { terragruntApply } from "./terragruntApply";
import { terragruntInit } from "./terragruntInit";
import type { CLIError } from "../error/error";
import type { PanfactumContext } from "@/context/context";

export async function terragruntInitAndApply({
  context,
  modulePath
}: {
  context: PanfactumContext;
  modulePath: string;
}): Promise<void | CLIError> {

  await terragruntInit({
    context,
    workingDirectory: modulePath,
  });

  return terragruntApply({
    context,
    workingDirectory: modulePath,
  });
}
