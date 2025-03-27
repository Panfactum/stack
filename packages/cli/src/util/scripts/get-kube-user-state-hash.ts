import { getRepoVariables } from "./get-repo-variables";
import { getFileMd5Hash } from "./helpers/get-file-md5-hash";
import { updateKubeHash } from "./shared-constants";
import type { BaseContext } from "clipanion";

/**
 * Generates a hash based on the Kubernetes configuration state
 * @param context - The base context for the CLI command
 * @returns A promise that resolves to the MD5 hash of the Kubernetes state
 */

export async function getKubeUserStateHash({
  context,
}: {
  context: BaseContext;
}) {
  const repoVariables = await getRepoVariables({
    context,
  });
  const kubeDir = repoVariables.kube_dir;

  const clusterInfoFilePath = `${kubeDir}/cluster_info`;
  const userConfigFilePath = `${kubeDir}/config.user.yaml`;

  const clusterInfoHash = await getFileMd5Hash(clusterInfoFilePath);
  const userConfigHash = await getFileMd5Hash(userConfigFilePath);

  const hasher = new Bun.CryptoHasher("md5");
  return hasher.update(`${updateKubeHash}${userConfigHash}${clusterInfoHash}`).digest("hex");
}
