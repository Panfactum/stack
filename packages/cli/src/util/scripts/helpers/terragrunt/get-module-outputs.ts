import { z } from "zod";
import { parseData } from "../../../parse-data";
import { progressMessage } from "../../../progress-message";
import type { BaseContext } from "clipanion";

export const getModuleOutputs = <T extends z.ZodTypeAny>({
  context,
  modulePath,
  validationSchema,
  verbose = false,
}: {
  context: BaseContext;
  modulePath: string;
  validationSchema: T;
  verbose?: boolean;
}) => {
  let moduleOutputProgress: globalThis.Timer | undefined;
  if (!verbose) {
    moduleOutputProgress = progressMessage({
      context,
      message: "Getting module outputs",
    });
  }

  if (verbose) {
    context.stdout.write(
      `Retrieving module outputs from ${modulePath}...\n`
    );
  }

  const moduleOutputs = Bun.spawnSync(
    ["terragrunt", "output", "--json", "--terragrunt-working-dir", modulePath],
    {
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  !verbose && globalThis.clearInterval(moduleOutputProgress);

  if (verbose) {
    context.stdout.write(
      "STDOUT: " + (moduleOutputs.stdout?.toString() ?? "") + "\n"
    );
    context.stderr.write(
      "STDERR: " + (moduleOutputs.stderr?.toString() ?? "") + "\n"
    );
  }

  const parsedModuleOutputs = JSON.parse(
    moduleOutputs.stdout?.toString() ?? ""
  );
  const validatedModuleOutputs = parseData(
    parsedModuleOutputs,
    validationSchema
  );

  if (verbose) {
    context.stdout.write("Done.\n");
  }

  // I have no idea why this is needed, but it is.
  // The returned value is typed when used from the calling function.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return validatedModuleOutputs;
};
