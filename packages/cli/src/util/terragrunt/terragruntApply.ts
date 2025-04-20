import { execute } from "../subprocess/execute";
import type { PanfactumContext } from "@/context/context";
import {join} from "node:path";

export async function terragruntApply({
  context,
  environment,
  region,
  module,
  onLogLine
}: {
  context: PanfactumContext;
  environment: string;
  region: string;
  module: string;
  onLogLine?: (line: string) => void;
}) {
  const workingDirectory = join(context.repoVariables.environments_dir, environment, region, module)

  await execute({
    command: [
      "terragrunt",
       "apply",
       "-no-color",
        "-auto-approve",
        "--terragrunt-non-interactive",
        "--terragrunt-no-color"
    ],
    context,
    workingDirectory,
    errorMessage: `Failed to apply infrastructure module ${module}`,
    onStdOutNewline: onLogLine,
    onStdErrNewline: onLogLine
  })

}
