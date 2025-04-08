import type { PanfactumContext } from "../../../context";
import { getFileMD5Hash } from "../../../util/getFileMD5Hash";
import { updateKubeHash } from "../../../util/scripts/shared-constants";

export async function getKubeStateHash({ context }: { context: PanfactumContext }) {
  const {kube_dir} = context.repoVariables;
  const configFileHash = await getFileMD5Hash(kube_dir + "/config.yaml");
  const hasher = new Bun.CryptoHasher("md5");
  return hasher.update(`${updateKubeHash}${configFileHash}`).digest("hex");
}
