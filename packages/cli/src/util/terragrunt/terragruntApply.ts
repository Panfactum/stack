import { join } from "node:path";
import { execute } from "../subprocess/execute";
import type { PanfactumContext } from "@/context/context";

export async function terragruntApply({
  context,
  env,
  environment,
  region,
  module,
  onLogLine,
}: {
  context: PanfactumContext;
  env?: Record<string, string | undefined>;
  environment: string;
  region: string;
  module: string;
  onLogLine?: (line: string) => void;
}) {
  const workingDirectory = join(
    context.repoVariables.environments_dir,
    environment,
    region,
    module
  );

  await execute({
    command: [
      "terragrunt",
      "apply",
      "-no-color",
      "-auto-approve",
      "--terragrunt-non-interactive",
      "--terragrunt-no-color",
    ],
    context,
    env,
    workingDirectory,
    errorMessage: `Failed to apply infrastructure module ${module}`,
    onStdOutNewline: onLogLine,
    onStdErrNewline: onLogLine,
  });
}
