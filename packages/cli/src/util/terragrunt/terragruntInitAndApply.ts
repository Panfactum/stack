import { terragruntApply } from "./terragruntApply";
import { terragruntInit } from "./terragruntInit";
import type { PanfactumContext } from "@/util/context/context";
import type { CLIError } from "@/util/error/error";

export async function terragruntInitAndApply(inputs: {
  context: PanfactumContext;
  environment: string;
  region: string;
  module: string;
}): Promise<void | CLIError> {

  await terragruntInit(inputs);
  return terragruntApply(inputs);
}
