import { z } from "zod";
import { parseData } from "../../util/parse-data";
import { progressMessage } from "../../util/progress-message";
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
      `Retrieving test configuration from ${modulePath}...\n`
    );
  }

  const moduleOutputs = Bun.spawnSync(
    ["terragrunt", "output", "--json", "--terragrunt-working-dir", modulePath],
    {
      stdout: verbose ? "inherit" : "ignore",
      stderr: "pipe",
    }
  );

  !verbose && globalThis.clearInterval(moduleOutputProgress);

  const validatedModuleOutputs = parseData(moduleOutputs, validationSchema);

  if (verbose) {
    context.stdout.write("Done.\n");
  }

  // I have no idea why this is needed, but it is.
  // The returned value is typed when used from the calling function.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return validatedModuleOutputs;
};
