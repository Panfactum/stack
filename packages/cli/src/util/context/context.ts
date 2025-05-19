import { getRepoVariables } from "./getRepoVariables";
import { Logger } from "./logger";
import type { BaseContext } from "clipanion";

export type PanfactumContext = BaseContext & {
  repoVariables: Awaited<ReturnType<typeof getRepoVariables>>;
  logger: Logger;
};

export const createPanfactumContext = async (
  context: BaseContext,
  opts: {
    debugEnabled: boolean;
    cwd: string;
  }
): Promise<PanfactumContext> => {
  return {
    ...context,
    repoVariables: await getRepoVariables(opts.cwd),
    logger: new Logger(context.stderr, opts.debugEnabled),
  };
};
