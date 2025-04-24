import { join } from "node:path";
import { execute } from "../subprocess/execute";
import type { PanfactumTaskWrapper } from "../listr/types";
import type { PanfactumContext } from "@/context/context";

export async function terragruntApplyAll({
  context,
  env,
  environment,
  region,
  task,
}: {
  context: PanfactumContext;
  env?: Record<string, string | undefined>;
  environment: string;
  region?: string;
  task?: PanfactumTaskWrapper;
}) {
  const workingDirectory = join(
    context.repoVariables.environments_dir,
    environment,
    region ?? ""
  );
  await execute({
    command: [
      "terragrunt",
      "run-all",
      "apply",
      "-auto-approve",
      "--terragrunt-non-interactive",
    ],
    env,
    context,
    workingDirectory,
    errorMessage: "Failed to apply infrastructure modules",
    task,
  });
}
