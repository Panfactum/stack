import { execute } from "../subprocess/execute";
import type { PanfactumContext } from "@/context/context";
import {join} from "node:path"

export async function terragruntApplyAll({
  context,
  env,
  environment,
  region
}: {
  context: PanfactumContext;
  env?: Record<string, string | undefined>;
  environment: string;
  region?: string;
}) {
  const workingDirectory = join(context.repoVariables.environments_dir, environment, region ?? "")
  await execute({
    command: [
      "terragrunt",
      "run-all",
      "apply",
      "-auto-approve",
      "--terragrunt-non-interactive"
    ],
    env,
    context,
    workingDirectory,
    errorMessage: "Failed to apply infrastructure modules"
  })

}
