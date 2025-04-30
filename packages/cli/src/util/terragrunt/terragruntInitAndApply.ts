import { terragruntApply } from "./terragruntApply";
import { terragruntInit } from "./terragruntInit";
import type { CLIError } from "../error/error";
import type { PanfactumContext } from "@/util/context/context";

export async function terragruntInitAndApply(inputs: {
  context: PanfactumContext;
  environment: string;
  region: string;
  module: string;
}): Promise<void | CLIError> {

  await terragruntInit(inputs);
  return terragruntApply(inputs);
}
