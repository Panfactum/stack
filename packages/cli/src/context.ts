import type { BaseContext } from "clipanion";
import type { getRepoVariables } from "./util/getRepoVariables";

export type PanfactumContext = BaseContext & {
  repoVariables: Awaited<ReturnType<typeof getRepoVariables>>;
};