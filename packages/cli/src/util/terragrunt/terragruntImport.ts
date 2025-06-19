import { join } from "node:path"
import { CLIError } from "@/util/error/error";
import { execute } from "@/util/subprocess/execute";
import type { PanfactumContext } from "@/util/context/context";

export async function terragruntImport({
  context,
  environment,
  region,
  module,
  resourceId,
  resourcePath,
  throwOnExists,
  onLogLine
}: {
  context: PanfactumContext;
  resourcePath: string;
  resourceId: string;
  environment: string;
  region: string;
  module: string;
  throwOnExists?: boolean;
  onLogLine?: (line: string) => void;
}) {


  const workingDirectory = join(context.repoVariables.environments_dir, environment, region, module)

  // Step 1: Check if it already imported
  const { exitCode } = await execute({
    command: [
      "terragrunt",
      "state",
      "show",
      "-no-color",
      resourcePath,
      "--terragrunt-non-interactive",
      "--terragrunt-no-color"
    ],
    context,
    workingDirectory,
    errorMessage: "Failed to check state of infrastructure modules",
    onStdErrNewline: onLogLine,
    onStdOutNewline: onLogLine,
    isSuccess: () => true
  })

  // That means the resource already exists in the state
  // so we cannot import
  if (exitCode === 0) {
    if (throwOnExists) {
      throw new CLIError(`Cannot import resource ${resourcePath} because it already exists in the state file`)
    }
    return
  }

  // Step 2: Import the resource
  await execute({
    command: [
      "terragrunt",
      "import",
      "-no-color",
      resourcePath,
      resourceId,
      "--terragrunt-no-color"
    ],
    context,
    workingDirectory,
    errorMessage: `Failed to import ${resourceId} to ${resourcePath}`,
    onStdOutNewline: onLogLine,
    onStdErrNewline: onLogLine
  })
}
