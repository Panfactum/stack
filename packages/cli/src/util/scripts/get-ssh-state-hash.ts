import { getRepoVariables } from "./get-repo-variables";
import { getFileMd5Hash } from "./helpers/get-file-md5-hash";
import { updateSSHHash } from "./shared-constants";
import type { BaseContext } from "clipanion";

// Purpose: Returns a state hash used to determine if pf update-ssh --build needs to be rerun.
export async function getSSHStateHash({ context }: { context: BaseContext }) {
  const repoVariables = await getRepoVariables({ context });
  const sshDir = repoVariables.ssh_dir;
  const configFilePath = sshDir + "/config.yaml";

  const configHash = await getFileMd5Hash(configFilePath);

  const hasher = new Bun.CryptoHasher("md5");
  return hasher.update(`${updateSSHHash}${configHash}`).digest("hex");
}
