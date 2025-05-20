import { getRepoVariables } from "./getRepoVariables";
import { Logger } from "./logger";
import { phClient } from "../posthog/tracking";
import type { BaseContext } from "clipanion";

export type PanfactumContext = BaseContext & {
  repoVariables: Awaited<ReturnType<typeof getRepoVariables>>;
  logger: Logger;
  track:  typeof phClient
};

export const createPanfactumContext = async (
  context: BaseContext,
  opts: {
    debugEnabled: boolean;
    cwd: string;
  }
): Promise<PanfactumContext> => {
  const repoVariables = await getRepoVariables(opts.cwd);

  if (repoVariables.user_id) {
    phClient.captureImmediate({
      event: 'cli-start',
      distinctId: repoVariables.user_id
    })
  }

  return {
    ...context,
    repoVariables,
    logger: new Logger(context.stderr, opts.debugEnabled),
    track: phClient
  };
};
