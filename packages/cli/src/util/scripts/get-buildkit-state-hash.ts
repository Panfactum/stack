import { safeDirectoryExists } from "../safe-directory-exists";
import { safeFileExists } from "../safe-file-exists";
import { getRepoVariables } from "./get-repo-variables";
import { updateBuildkitHash } from "./shared-constants";
import type { BaseContext } from "clipanion";

export async function getBuildkitStateHash({
  context,
}: {
  context: BaseContext;
}) {
  const repoVariables = await getRepoVariables({ context });
  const buildkitDirPath = repoVariables.buildkit_dir;
  let configFileHash;

  if (await safeDirectoryExists(buildkitDirPath)) {
    if (await safeFileExists(buildkitDirPath + "/config.yaml")) {
      const hasher = new Bun.CryptoHasher("md5");
      configFileHash = hasher
        .update(Bun.file(buildkitDirPath + "/config.yaml"))
        .digest("hex");
    }
  }

  const hasher = new Bun.CryptoHasher("md5");
  return hasher.update(`${updateBuildkitHash}${configFileHash}`).digest("hex");
}
