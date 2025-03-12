import pc from "picocolors";
import { printHelpInformation } from "../../util/print-help-information";
import { progressMessage } from "../../util/progress-message";
import type { BaseContext } from "clipanion";

export function apply({
  context,
  verbose = false,
  workingDirectory = ".",
}: {
  context: BaseContext;
  verbose?: boolean;
  workingDirectory?: string;
}): 0 | 1 {
  try {
    let tfApplyProgress: globalThis.Timer | undefined;
    if (!verbose) {
      tfApplyProgress = progressMessage({
        context,
        message: "Applying infrastructure modules",
      });
    }

    const initProcess = Bun.spawnSync(
      ["terragrunt", "apply", "-auto-approve"],
      {
        cwd: workingDirectory,
        stdout: verbose ? "inherit" : "ignore",
        stderr: "pipe",
      }
    );

    // Clear the progress interval
    !verbose && globalThis.clearInterval(tfApplyProgress);

    // Check if the init process failed
    if (initProcess.exitCode !== 0) {
      context.stderr.write(initProcess.stderr.toString());
      context.stdout.write(pc.red("Failed to apply infrastructure modules.\n"));
      context.stdout.write(
        pc.red(
          "Please check the logs above for more information and try again.\n"
        )
      );
      printHelpInformation(context);
      return 1;
    }

    !verbose &&
      context.stdout.write(
        pc.green("Successfully applied all infrastructure modules\n")
      );

    return 0;
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? `Error applying infrastructure modules: ${error.message}`
        : "Error applying infrastructure modules";
    context.stderr.write(`${pc.red(errorMessage)}\n`);
    return 1;
  }
}
