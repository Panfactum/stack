import { getRepoVariables } from "./get-repo-variables";
import { updateKubeHash } from "./shared-constants";
import { safeDirectoryExists } from "../safe-directory-exists";
import { getFileMd5Hash } from "./helpers/get-file-md5-hash";
import type { BaseContext } from "clipanion";

/**
 * Generates a hash based on the Kubernetes configuration state
 * @param context - The base context for the CLI command
 * @returns A promise that resolves to the MD5 hash of the Kubernetes state
 */
export async function getKubeStateHash({ context }: { context: BaseContext }) {
  const repoVariables = await getRepoVariables({ context });
  const kubeDir = repoVariables.kube_dir;
  const configFilePath = `${kubeDir}/config.yaml`;

  let configFileHash;
  if (await safeDirectoryExists(kubeDir)) {
    configFileHash = await getFileMd5Hash(configFilePath);
  }

  const hasher = new Bun.CryptoHasher("md5");
  return hasher.update(`${updateKubeHash}${configFileHash}`).digest("hex");
}
