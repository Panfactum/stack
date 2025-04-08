import type { PanfactumContext } from "../../../context";
import { getFileMD5Hash } from "../../../util/getFileMD5Hash";
import { updateBuildkitHash } from "../../../util/scripts/shared-constants";

export async function getBuildkitStateHash({
  context,
}: {
  context:  PanfactumContext;
}) {
  const {buildkit_dir} = context.repoVariables;
  const configFileHash = await getFileMD5Hash(buildkit_dir + "/config.yaml");
  const hasher = new Bun.CryptoHasher("md5");
  return hasher.update(`${updateBuildkitHash}${configFileHash}`).digest("hex");
}
