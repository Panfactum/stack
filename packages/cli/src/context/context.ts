import { getRepoVariables } from "./getRepoVariables";
import { Logger } from "./logger";
import type { BaseContext } from "clipanion";

export type PanfactumContext = BaseContext & {
  repoVariables: Awaited<ReturnType<typeof getRepoVariables>>;
  logger: Logger;
};

export const createPanfactumContext = async (
  context: BaseContext
): Promise<PanfactumContext> => {
  return {
    ...context,
    repoVariables: await getRepoVariables(),
    // TODO: @jack get the log level into this
    logger: new Logger(context.stderr),
  };
};
