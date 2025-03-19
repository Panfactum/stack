import { getRepoVariables } from "./get-repo-variables";
import { getSSHStateHash } from "./get-ssh-state-hash";
import { safeExists } from "./safe-exists";
import envrcTemplate from "../../files/direnv/envrc" with { type: "file" };
import type { BaseContext } from "clipanion";

// Purpose: to check if two files are equal byte by byte
// Equivalent to the `cmp` command
async function areFilesEqual(file1Path: string, file2Path: string) {
  try {
    // Read both files as buffers
    const buffer1 = await Bun.file(file1Path).bytes();
    const buffer2 = await Bun.file(file2Path).bytes();

    // Compare buffer lengths first (quick check)
    if (buffer1.length !== buffer2.length) {
      return false;
    }

    // Compare buffers byte by byte
    return buffer1.every((value, index) => value === buffer2[index]);
  } catch {
    return false;
  }
}

// Utility for comparing if a destination directory contains exact copies of the
// files in the source directory (relative locations are expected to be the same)
async function areDirectoriesEqual(
  destinationDir: string,
  sourceDir: string
): Promise<boolean> {
  try {
    // Get all files in the source directory recursively
    const glob = new Bun.Glob("**/*");
    const sourceFiles = await Array.fromAsync(glob.scan(sourceDir));

    // Check each sourcse file against its corresponding destination file
    for (const srcFile of sourceFiles) {
      // Generate the corresponding destination file path
      const relativePath = srcFile.substring(sourceDir.length);
      const destFile = `${destinationDir}${relativePath}`;

      // Check if destination file exists and compare contents
      try {
        if (!(await areFilesEqual(srcFile, destFile))) {
          return false;
        }
      } catch {
        // Destination file doesn't exist or can't be read
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

// Purpose: There are many setup steps that are required to ensure that users of the Panfactum stack have
// a smooth experience. This utility function should be run every time the devenv gets launched in order
// to ensure that the setup steps have been completed properly.
export async function checkRepoSetup({ context }: { context: BaseContext }) {
  // Aggregate all of the error messages here and print them all at the end
  const errors = [];
  let hasBuildRequiredError = 0;
  //####################################################################
  // Get Repo Variables
  //####################################################################
  const repoVariables = await getRepoVariables({ context });
  if (!repoVariables) {
    context.stderr.write(
      `Error: You must create a repo configuration variables file at panfactum.yaml to use the devenv! See https://panfactum.com/docs/edge/reference/configuration/repo-variables.\n`
    );
    throw new Error(
      `You must create a repo configuration variables file at panfactum.yaml to use the devenv! See https://panfactum.com/docs/edge/reference/configuration/repo-variables.`
    );
  }

  const repoRoot = repoVariables.repo_root;

  //####################################################################
  // Check Top-level .gitignore setup
  //####################################################################
  function isIgnored(path: string) {
    return Bun.spawnSync([
      "git",
      "check-ignore",
      `${repoRoot}/${path}`,
    ]).stdout.toString();
  }

  if (
    !isIgnored(".env") ||
    !isIgnored(".terragrunt-cache") ||
    !isIgnored(".terraform") ||
    !isIgnored(".devenv") ||
    !isIgnored(".direnv") ||
    !isIgnored(".nats")
  ) {
    errors.push(
      `Error: .gitignore file is missing files/directories that should not be committed. Run pf update-gitignore to update.\n\n`
    );
  }

  //####################################################################
  // Check envrc setup
  //####################################################################
  if (!(await areFilesEqual(`${repoRoot}/.envrc`, envrcTemplate))) {
    errors.push(
      `Error: .envrc file is out of date. Run pf update-envrc to update.\n\n`
    );
  }

  //####################################################################
  // Check terragrunt setup
  //####################################################################
  const environmentsDir = repoVariables.environments_dir;
  // See: https://bun.sh/docs/bundler/executables#embed-directories
  // This static path will remain constant even if the CLI is bundled though don't want to rely on it
  // too much as the documentation states that it may change in the future
  if (!(await areDirectoriesEqual("../../files/terragrunt", environmentsDir))) {
    errors.push(
      `Error: Terragrunt files are out of date. Run pf update-terragrunt to update.\n\n`
    );
  }

  //####################################################################
  // Check ssh setup
  //####################################################################
  const sshDir = repoVariables.ssh_dir;
  if (!(await areDirectoriesEqual("../../files/ssh", sshDir))) {
    errors.push(
      `SSH files are out of date. Run pf update-ssh to update.\n\n`
    );
  } else if (
    (await getSSHStateHash()) !==
    (await Bun.file(sshDir + "/state.lock").text())
  ) {
    if (await safeExists(sshDir + "/config.yaml")) {
      hasBuildRequiredError = 1;
      errors.push(
        `Generated SSH config files are out of date. A superuser must run 'pf update-ssh --build' to update.\n\n`
      );
    } else {
      errors.push(
        `SSH files are out of date. Run pf update-ssh to update.\n\n`
      );
    }
  }
}
