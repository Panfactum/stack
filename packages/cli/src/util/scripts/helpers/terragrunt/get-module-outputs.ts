import { z } from "zod";
import { parseData } from "../../../parse-data";
import { progressMessage } from "../../../progress-message";
import type { BaseContext } from "clipanion";

export const getModuleOutputs = async <T extends z.ZodTypeAny>({
  context,
  modulePath,
  silent = false,
  validationSchema,
  verbose = false,
}: {
  context: BaseContext;
  modulePath: string;
  silent?: boolean;
  validationSchema: T;
  verbose?: boolean;
}) => {
  let moduleOutputProgress: globalThis.Timer | undefined;
  if (!verbose && !silent) {
    moduleOutputProgress = progressMessage({
      context,
      message: "Getting module outputs",
    });
  }

  if (verbose) {
    context.stdout.write(`Retrieving module outputs from ${modulePath}...\n`);
  }

  // TODO: You MUST verify that the user is logged in before running this command

  const moduleOutputsProc = Bun.spawn(
    ["terragrunt", "output", "--json"],
    {
      cwd: modulePath,
      stdout: "pipe",
      stderr: "pipe",
    }
  );

<<<<<<< HEAD
  !verbose && !silent && globalThis.clearInterval(moduleOutputProgress);
  !verbose && !silent && context.stdout.write("\n");
||||||| parent of 7d0e2eec (chore: cli refactor)
  !verbose && globalThis.clearInterval(moduleOutputProgress);
  context.stdout.write("\n");
=======
  await moduleOutputsProc.exited
  const stdout = await new Response(moduleOutputsProc.stdout).text()

  !verbose && globalThis.clearInterval(moduleOutputProgress);
  context.stdout.write("\n");
>>>>>>> 7d0e2eec (chore: cli refactor)

  if (true) {
    context.stdout.write(
      "STDOUT: " + stdout + "\n"
    );
    const stderr = await new Response(moduleOutputsProc.stderr).text()
    context.stderr.write(
      "STDERR: " + stderr + "\n"
    );
  }

  const parsedModuleOutputs = JSON.parse(stdout);
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
