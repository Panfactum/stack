import pc from "picocolors";
import { printHelpInformation } from "../../util/print-help-information";
import { progressMessage } from "../../util/progress-message";
import type { BaseContext } from "clipanion";

export function runAllApply({
  context,
  env,
  suppressErrors = false,
  verbose = false,
  workingDirectory = ".",
}: {
  context: BaseContext;
  env?: Record<string, string | undefined>;
  suppressErrors?: boolean;
  verbose?: boolean;
  workingDirectory?: string;
}): 0 | never {
  try {
    let tfApplyProgress: globalThis.Timer | undefined;
    if (!verbose) {
      tfApplyProgress = progressMessage({
        context,
        message: "Applying all infrastructure modules",
      });
    }

    const initProcess = Bun.spawnSync(
      ["terragrunt", "run-all", "apply", "--terragrunt-non-interactive"],
      {
        cwd: workingDirectory,
        env,
        stdout: verbose ? "inherit" : "ignore",
        stderr: "pipe",
      }
    );

    // Clear the progress interval
    !verbose && globalThis.clearInterval(tfApplyProgress);
    context.stdout.write("\n");

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
      throw new Error("Failed to apply infrastructure modules");
    }

    !verbose &&
      context.stdout.write(
        pc.green("Successfully applied all infrastructure modules\n")
      );

    return 0;
  } catch (error: unknown) {
    // The only current use case for this and when we're first applying the Vault module which may fail initially.
    // We won't write anything to the console and handle the thrown error in the calling function.
    if (!suppressErrors) {
      const errorMessage =
        error instanceof Error
          ? `Error applying infrastructure modules: ${error.message}`
          : "Error applying infrastructure modules";
      context.stderr.write(`${pc.red(errorMessage)}\n`);
    }
    throw new Error("Failed to apply infrastructure modules");
  }
}
