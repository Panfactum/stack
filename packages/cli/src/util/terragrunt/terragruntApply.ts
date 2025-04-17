import { execute } from "../subprocess/execute";
import type { PanfactumContext } from "@/context/context";

export async function terragruntApply({
  context,
  env,
  workingDirectory = ".",
}: {
  context: PanfactumContext;
  env?: Record<string, string | undefined>;
  workingDirectory?: string;
}) {

  await execute({
    command: ["terragrunt", "apply", "-auto-approve"],
    env,
    context,
    workingDirectory,
    errorMessage: "Failed to init infrastructure modules"
  })

}
