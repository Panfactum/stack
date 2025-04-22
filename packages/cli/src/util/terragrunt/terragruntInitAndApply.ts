import { terragruntApply } from "./terragruntApply";
import type { CLIError } from "../error/error";
import type { PanfactumContext } from "@/context/context";
import { terragruntInit } from "./terragruntInit";

export async function terragruntInitAndApply(inputs: {
  context: PanfactumContext;
  environment: string;
  region: string;
  module: string;
}): Promise<void | CLIError> {

  await terragruntInit(inputs);
  return terragruntApply(inputs);
}
