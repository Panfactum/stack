import { safeFileExists } from "../safe-file-exists";
import { getRepoVariables } from "./get-repo-variables";
import type { BaseContext } from "clipanion";

// This function is intended to support getting an EKS auth token
// We use this thin wrapper over the AWS CLI as
// users of the Panfactum stack seem to get confused about needing to run aws sso login prior
// to attempting to interact with EKS clusters

const getToken = ({
  awsProfile,
  clusterName,
  region,
}: {
  awsProfile: string;
  clusterName: string;
  region: string;
}) =>
  Bun.spawnSync([
    "aws",
    "eks",
    "get-token",
    "--cluster-name",
    clusterName,
    "--profile",
    awsProfile,
    "--region",
    region,
    "--output",
    "json",
  ]);

const cleanup = async (filePath: string) => {
  if (await safeFileExists(filePath)) {
    const file = Bun.file(filePath);
    await file.delete();
  }
};

export async function getKubeToken({
  awsProfile,
  clusterName,
  context,
  region,
}: {
  awsProfile: string;
  clusterName: string;
  context: BaseContext;
  region: string;
}) {
  const repoVariables = await getRepoVariables({ context });
  const kubeDir = repoVariables.kube_dir;

  const proc = getToken({ awsProfile, clusterName, region });
  if (proc.exitCode === 0) {
    return proc.stdout;
  }
  // This ensures that only one sso process is running at a time
  const awsSsoLockFilePath = `${kubeDir}/aws.lock`;
  if (await safeFileExists(awsSsoLockFilePath)) {
    // Wait for a bit if the lock is held by another process
    // to prevent duplicate prompts
    const maxWait = 180;
    let currentWait = 0;
    while (await safeFileExists(awsSsoLockFilePath)) {
      await new Promise((resolve) => globalThis.setTimeout(resolve, 1000));
      currentWait++;
      if (currentWait >= maxWait) {
        const awsSsoLockFile = Bun.file(awsSsoLockFilePath);
        await awsSsoLockFile.delete();
        break;
      }
    }

    // If we are sleeping, when we wake, we should try again to get the token
    // before we initiate the sso login b/c the sso login might have happened
    // in another process
    const proc = getToken({ awsProfile, clusterName, region });
    if (proc.exitCode === 0) {
      return proc.stdout;
    }
  }

  const procOutput = proc.stderr.toString();

  if (
    procOutput.includes(
      `Error loading SSO Token: Token for ${awsProfile} does not exist`
    )
  ) {
    try {
      await Bun.write(awsSsoLockFilePath, "");
      Bun.spawnSync(["aws", "sso", "login", "--profile", awsProfile], {
        stderr: "inherit",
        stdout: "inherit",
        timeout: 1800,
      });

      // Hit the timeout limit or was killed so we cleanup and do nothing else
      if (["SIGINT", "SIGTERM"].includes(proc.signalCode ?? "")) {
        await cleanup(awsSsoLockFilePath);
        return;
      }

      return getToken({ awsProfile, clusterName, region }).stdout;
    } finally {
      // If there's an error, we still want to cleanup the lock file
      await cleanup(awsSsoLockFilePath);
    }
  } else if (
    procOutput.includes(
      `Error when retrieving token from sso: Token has expired and refresh failed`
    )
  ) {
    try {
      await Bun.write(awsSsoLockFilePath, "");
      const proc = Bun.spawnSync(
        ["aws", "sso", "logout", "--profile", awsProfile],
        {
          stdout: "inherit",
          stderr: "inherit",
          timeout: 1800,
        }
      );

      // Hit the timeout limit or was killed so we cleanup and do nothing else
      if (["SIGINT", "SIGTERM"].includes(proc.signalCode ?? "")) {
        await cleanup(awsSsoLockFilePath);

        return;
      }

      return getToken({ awsProfile, clusterName, region }).stdout;
    } finally {
      // If there's an error, we still want to cleanup the lock file
      await cleanup(awsSsoLockFilePath);
    }
  } else {
    // Write the raw error output to stderr
    context.stderr.write(`AWS EKS token error: ${procOutput}\n`);
    throw new Error(`Failed to get EKS token: ${procOutput}`);
  }
}
