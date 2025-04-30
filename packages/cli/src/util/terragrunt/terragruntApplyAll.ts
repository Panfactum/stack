import { join } from "node:path";
import { execute } from "../subprocess/execute";
import type { PanfactumContext } from "@/util/context/context";

export async function terragruntApplyAll({
  context,
  env,
  environment,
  region,
  onLogLine,
}: {
  context: PanfactumContext;
  env?: Record<string, string | undefined>;
  environment: string;
  region?: string;
  onLogLine?: (line: string) => void;
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
    onStdOutNewline: onLogLine,
    onStdErrNewline: onLogLine,
  });
}
