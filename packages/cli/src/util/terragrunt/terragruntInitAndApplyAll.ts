import { terragruntApplyAll } from "./terragruntApplyAll";
import { terragruntInitAll } from "./terragruntInitAll";
import type { PanfactumContext } from "@/util/context/context";
import type { CLIError } from "@/util/error/error";

export async function terragruntInitAndApplyAll(inputs: {
  context: PanfactumContext;
  environment: string;
  region: string;
}): Promise<void | CLIError> {

  await terragruntInitAll(inputs);
  return terragruntApplyAll(inputs);
}
