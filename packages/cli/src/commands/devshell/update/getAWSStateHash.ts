import { updateAWSHash } from "../../../util/scripts/shared-constants";
import { getFileMD5Hash } from "../../../util/getFileMD5Hash";
import type { PanfactumContext } from "../../../context";

export async function getAWSStateHash({ context }: { context: PanfactumContext }) {
  const {aws_dir} = context.repoVariables;
  const configFileHash = await getFileMD5Hash(aws_dir + "/config.yaml");
  const hasher = new Bun.CryptoHasher("md5");
  return hasher.update(`${updateAWSHash}${configFileHash}`).digest("hex");
}
