import pc from "picocolors";
import { printHelpInformation } from "../print-help-information";
import { progressMessage } from "../progress-message";
import { writeErrorToDebugFile } from "../write-error-to-debug-file";
import type { BaseContext } from "clipanion";

export function tfInit({
  silent = false,
  context,
  env,
  verbose = false,
  workingDirectory = ".",
}: {
  context: BaseContext;
  env?: Record<string, string | undefined>;
  silent?: boolean;
  verbose?: boolean;
  workingDirectory?: string;
}): 0 | never {
  try {
    let tfInitProgress: globalThis.Timer | undefined;
    if (!verbose && !silent) {
      tfInitProgress = progressMessage({
        context,
        message: "Initializing and upgrading infrastructure modules",
      });
    }

    // Step 1: Run init -upgrade on all modules
    const initProcess = Bun.spawnSync(
      [
        "terragrunt",
        "run-all",
        "init",
        "-upgrade",
        "--terragrunt-ignore-external-dependencies",
      ],
      {
        cwd: workingDirectory,
        env,
        stdout: verbose ? "inherit" : "ignore",
        stderr: "pipe",
      }
    );

    // Clear the progress interval
    !verbose && !silent && globalThis.clearInterval(tfInitProgress);
    !verbose && !silent && context.stdout.write("\n");

    // Check if the init process failed
    if (initProcess.exitCode !== 0) {
      context.stderr.write(initProcess.stderr.toString());
      context.stdout.write(
        pc.red("Failed to initialize infrastructure modules.\n")
      );
      context.stdout.write(
        pc.red(
          "Please check the logs above for more information and try again.\n"
        )
      );
      writeErrorToDebugFile({
        context,
        error: `Failed to initialize infrastructure modules: ${initProcess.stderr.toString()}`,
      });
      printHelpInformation(context);
      throw new Error("Failed to initialize infrastructure modules");
    }

    !verbose &&
      !silent &&
      context.stdout.write(
        pc.green("Successfully initialized infrastructure modules\n")
      );

    let tfLockProgress: globalThis.Timer | undefined;
    if (!verbose && !silent) {
      tfLockProgress = progressMessage({
        context,
        message: "Updating platform locks for all platforms",
      });
    }

    // Step 2: Update the platform locks to include all platforms
    const lockProcess = Bun.spawnSync(
      [
        "terragrunt",
        "run-all",
        "providers",
        "lock",
        "-platform=linux_amd64",
        "-platform=linux_arm64",
        "-platform=darwin_amd64",
        "-platform=darwin_arm64",
        "--terragrunt-ignore-external-dependencies",
      ],
      {
        cwd: workingDirectory,
        env,
        stdout: verbose ? "inherit" : "ignore",
        stderr: "pipe",
      }
    );

    // Clear the progress interval
    !verbose && !silent && globalThis.clearInterval(tfLockProgress);
    !verbose && !silent && context.stdout.write("\n");

    // Check if the lock process failed
    if (lockProcess.exitCode !== 0) {
      context.stderr.write(lockProcess.stderr.toString());
      context.stdout.write(pc.red("Failed to update platform locks.\n"));
      context.stdout.write(
        pc.red(
          "Please check the logs above for more information and try again.\n"
        )
      );
      writeErrorToDebugFile({
        context,
        error: `Failed to update platform locks: ${lockProcess.stderr.toString()}`,
      });
      printHelpInformation(context);
      throw new Error("Failed to update platform locks");
    }

    !verbose &&
      !silent &&
      context.stdout.write(pc.green("Successfully updated platform locks\n"));
    return 0;
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? `Error initializing infrastructure modules: ${error.message}`
        : "Error initializing infrastructure modules";
    context.stderr.write(`${pc.red(errorMessage)}\n`);
    throw new Error("Failed to initialize infrastructure modules");
  }
}
