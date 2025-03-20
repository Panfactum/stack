import { safeFileExists } from "../safe-file-exists";
import { getRepoVariables } from "./get-repo-variables";
import { updateAWSHash } from "./shared-constants";
import { safeDirectoryExists } from "../safe-directory-exists";
import type { BaseContext } from "clipanion";

export async function getAWSStateHash({ context }: { context: BaseContext }) {
  const repoVariables = await getRepoVariables({ context });
  const awsDir = repoVariables.aws_dir;
  let configFileHash;

  if (await safeDirectoryExists(awsDir)) {
    if (await safeFileExists(awsDir + "/config.yaml")) {
      const hasher = new Bun.CryptoHasher("md5");
      configFileHash = hasher
        .update(Bun.file(awsDir + "/config.yaml"))
        .digest("hex");
    }
  }

  const hasher = new Bun.CryptoHasher("md5");
  return hasher.update(`${updateAWSHash}${configFileHash}`).digest("hex");
}
