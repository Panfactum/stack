import path from "node:path";

/**
 * Gets the repository root (or root of panfactum.yaml if using reference env)
 * @param startDir Optional starting directory, defaults to current working directory
 * @returns Object containing root and gitRoot paths
 */
export async function getRepoVariables(startDir?: string): Promise<{
  root: string;
  gitRoot: string;
}> {
  // Step 1: Get to the repository root (or root of panfactum.yaml if using reference env)
  let root = path.resolve(startDir ?? process.cwd());

  // Find the root directory (containing .git or panfactum.yaml)
  while (
    !(await Bun.file(path.join(root, ".git")).exists()) &&
    !(await Bun.file(path.join(root, "panfactum.yaml")).exists())
  ) {
    const parentDir = path.dirname(root);
    if (parentDir === root) {
      throw new Error("Could not find repository root or panfactum.yaml");
    }
    root = parentDir;
  }

  // Find the git root directory
  let gitRoot = path.resolve(startDir ?? process.cwd());

  while (!(await Bun.file(path.join(gitRoot, ".git")).exists())) {
    const parentDir = path.dirname(gitRoot);
    if (parentDir === gitRoot) {
      throw new Error("Could not find git repository root");
    }
    gitRoot = parentDir;
  }

  return { root, gitRoot };
}
