import { safeDirectoryExists } from "../safe-directory-exists";
import { getRepoVariables } from "./get-repo-variables";
import { getFileMd5Hash } from "./helpers/get-file-md5-hash";
import { updateBuildkitHash } from "./shared-constants";
import type { BaseContext } from "clipanion";

/**
 * Generates a hash based on the Buildkit configuration state
 * @param context - The base context for the CLI command
 * @returns A promise that resolves to the MD5 hash of the Buildkit state
 */
export async function getBuildkitUserStateHash({
  context,
}: {
  context: BaseContext;
}) {
  const repoVariables = await getRepoVariables({ context });
  const buildkitDirPath = repoVariables.buildkit_dir;
  let configFileHash;

  if (await safeDirectoryExists(buildkitDirPath)) {
    configFileHash = await getFileMd5Hash(buildkitDirPath + "/state.lock");
  }

  const hasher = new Bun.CryptoHasher("md5");
  return hasher.update(`${updateBuildkitHash}${configFileHash}`).digest("hex");
}
