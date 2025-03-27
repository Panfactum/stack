import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Gets the repository root (or root of panfactum.yaml if using reference env)
 * @param startDir Optional starting directory, defaults to current working directory
 * @returns Object containing root and gitRoot paths
 */
export async function getRoot(startDir?: string): Promise<{
  root: string;
  gitRoot: string;
}> {
  // Step 1: Get to the repository root (or root of panfactum.yaml if using reference env)
  let root = path.resolve(startDir ?? process.cwd());

  // Find the root directory (containing .git or panfactum.yaml)
  while (
    !existsSync(path.join(root, ".git")) &&
    !existsSync(path.join(root, "panfactum.yaml"))
  ) {
    const parentDir = path.dirname(root);
    if (parentDir === root) {
      throw new Error("Could not find repository root or panfactum.yaml");
    }
    root = parentDir;
  }

  // Find the git root directory
  let gitRoot = path.resolve(startDir ?? process.cwd());

  while (!existsSync(path.join(gitRoot, ".git"))) {
    const parentDir = path.dirname(gitRoot);
    if (parentDir === gitRoot) {
      throw new Error("Could not find git repository root");
    }
    gitRoot = parentDir;
  }

  return { root, gitRoot };
}
