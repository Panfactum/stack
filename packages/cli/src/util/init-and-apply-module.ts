import pc from "picocolors";
import { progressMessage } from "./progress-message";
import { tfInit } from "./scripts/tf-init";
import { writeErrorToDebugFile } from "./write-error-to-debug-file";
import { apply } from "../commands/terragrunt/apply";
import type { BaseContext } from "clipanion";

export async function initAndApplyModule({
  context,
  env,
  moduleName,
  modulePath,
  verbose,
}: {
  context: BaseContext;
  env?: Record<string, string | undefined>;
  moduleName: string;
  modulePath: string;
  verbose?: boolean;
}) {
  let tfInitProgress: globalThis.Timer | undefined;
  try {
    if (!verbose) {
      tfInitProgress = progressMessage({
        context,
        message: `Initializing and upgrading ${moduleName} infrastructure module`,
      });
    }

    tfInit({
      context,
      env,
      silent: true,
      verbose,
      workingDirectory: modulePath,
    });

    apply({
      context,
      env,
      silent: true,
      verbose,
      workingDirectory: modulePath,
    });

    globalThis.clearInterval(tfInitProgress);
    !verbose &&
      context.stdout.write(
        pc.green(
          `\rSuccessfully initialized and applied ${moduleName} module.          \n\n`
        )
      );
  } catch (error: unknown) {
    globalThis.clearInterval(tfInitProgress);
    const errorMessage =
      error instanceof Error
        ? `Error initializing infrastructure modules: ${error.message}`
        : "Error initializing infrastructure modules";
    context.stderr.write(`${pc.red(errorMessage)}\n`);
    writeErrorToDebugFile({
      context,
      error,
    });
    throw new Error("Failed to initialize infrastructure modules");
  }
}
