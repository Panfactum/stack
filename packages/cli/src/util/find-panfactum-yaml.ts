import { dirname, join } from "path";

// Function to find panfactum.yaml by recursively looking up the directory tree
export const findPanfactumYaml = async (
  dir: string
): Promise<string | null> => {
  const panfactumPath = join(dir, "panfactum.yaml");
  if (await Bun.file(panfactumPath).exists()) {
    return panfactumPath;
  }

  const parentDir = dirname(dir);
  // Stop if we've reached the root directory
  if (parentDir === dir) {
    return null;
  }

  return findPanfactumYaml(parentDir);
};
