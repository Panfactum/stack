import { getRepoVariables } from "./get-repo-variables";
import { updateAWSHash } from "./shared-constants";
import { safeDirectoryExists } from "../safe-directory-exists";
import { getFileMd5Hash } from "./helpers/get-file-md5-hash";
import type { BaseContext } from "clipanion";

/**
 * Generates a hash based on the AWS configuration state
 * @param context - The base context for the CLI command
 * @returns A promise that resolves to the MD5 hash of the AWS state
 */
export async function getAWSStateHash({ context }: { context: BaseContext }) {
  const repoVariables = await getRepoVariables({ context });
  const awsDir = repoVariables.aws_dir;
  let configFileHash;

  if (await safeDirectoryExists(awsDir)) {
    configFileHash = await getFileMd5Hash(awsDir + "/config.yaml");
  }

  const hasher = new Bun.CryptoHasher("md5");
  return hasher.update(`${updateAWSHash}${configFileHash}`).digest("hex");
}
