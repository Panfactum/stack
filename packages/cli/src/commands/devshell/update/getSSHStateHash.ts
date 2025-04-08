import { getFileMD5Hash } from "../../../util/getFileMD5Hash";
import { updateSSHHash } from "../../../util/scripts/shared-constants";
import type { PanfactumContext } from "../../../context";

export async function getSSHStateHash({ context }: { context: PanfactumContext }) {
  const { ssh_dir } = context.repoVariables;
  const configHash = await getFileMD5Hash(ssh_dir + "/config.yaml");
  const hasher = new Bun.CryptoHasher("md5");
  return hasher.update(`${updateSSHHash}${configHash}`).digest("hex");
}
