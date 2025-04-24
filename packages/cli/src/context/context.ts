import { getRepoVariables } from "./getRepoVariables";
import { Logger, type LogLevel } from "./logger";
import type { BaseContext } from "clipanion";

export type PanfactumContext = BaseContext & {
  repoVariables: Awaited<ReturnType<typeof getRepoVariables>>;
  logger: Logger;
};

export const createPanfactumContext = async (
  context: BaseContext,
  opts: {
    logLevel: LogLevel;
  }
): Promise<PanfactumContext> => {
  return {
    ...context,
    repoVariables: await getRepoVariables(),
    logger: new Logger(context.stderr, { logLevel: opts.logLevel }),
  };
};
