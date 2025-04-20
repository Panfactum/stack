import type { CLIError } from "../error/error";
import type { PanfactumContext } from "@/context/context";
import { terragruntApplyAll } from "./terragruntApplyAll";
import { terragruntInitAll } from "./terragruntInitAll";

export async function terragruntInitAndApplyAll(inputs: {
  context: PanfactumContext;
  environment: string;
  region?: string;
}): Promise<void | CLIError> {

  await terragruntInitAll(inputs);
  return terragruntApplyAll(inputs);
}
