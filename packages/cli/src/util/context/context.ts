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
    cwd?: string;
  }
): Promise<PanfactumContext> => {
  if (opts.cwd) {
    process.chdir(opts.cwd);
  }
  
  return {
    ...context,
    repoVariables: await getRepoVariables(),
    logger: new Logger(context.stderr, opts.debugEnabled),
  };
};
