import { getRepoVariables } from "./get-repo-variables";
import { updateKubeHash } from "./shared-constants";
import { safeFileExists } from "../safe-file-exists";
import type { BaseContext } from "clipanion";

// Purpose: Returns a state hash used to determine if pf update-kube needs to be rerun.

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
  let clusterInfoHash = "";
  let userConfigHash = "";

  if (await safeFileExists(clusterInfoFilePath)) {
    const hasher = new Bun.CryptoHasher("md5");
    clusterInfoHash = hasher
      .update(Bun.file(clusterInfoFilePath))
      .digest("hex");
  }

  if (await safeFileExists(userConfigFilePath)) {
    const userConfigFileBlob = Bun.file(userConfigFilePath);
    const hasher = new Bun.CryptoHasher("md5");
    userConfigHash = hasher.update(userConfigFileBlob).digest("hex");
  }

  const hasher = new Bun.CryptoHasher("md5");
  hasher.update(`${updateKubeHash}${userConfigHash}${clusterInfoHash}`);
  return hasher.digest("hex");
}
