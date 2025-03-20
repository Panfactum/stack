import { getRepoVariables } from "./get-repo-variables";
import { updateKubeHash } from "./shared-constants";
import type { BaseContext } from "clipanion";

export const getKubeStateHash = async ({
  context,
}: {
  context: BaseContext;
}) => {
  const repoVariables = await getRepoVariables({ context });
  const kubeDir = repoVariables.kube_dir;

  // The original script has a check to ensure kubeDir exists here
  // However, getRepoVariables sets this value with a default if it doesn't exist
  // so there is no need to do that anymore
  const configFile = `${kubeDir}/config.yaml`;
  let configFileExists = false;
  try {
    configFileExists = await Bun.file(configFile).exists();
  } catch {
    // Ignore any errors, just keep configFileExists as false
  }
  let configFileHash;
  if (configFileExists) {
    const configFileBlob = Bun.file(configFile);
    const hasher = new Bun.CryptoHasher("md5");
    configFileHash = hasher.update(configFileBlob).digest("hex");
  }

  const hasher = new Bun.CryptoHasher("md5");
  return hasher.update(`${updateKubeHash}${configFileHash}`).digest("hex");
};
