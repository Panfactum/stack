import { getRepoVariables } from "./get-repo-variables";
import type { BaseContext } from "clipanion";

export async function updateKube({
  buildConfig,
  context,
}: {
  buildConfig: boolean;
  context: BaseContext;
}) {
  const repoVariables = await getRepoVariables({ context });
  const kubeDir = repoVariables.kube_dir;
  const environmentsDir = repoVariables.environments_dir;
}
