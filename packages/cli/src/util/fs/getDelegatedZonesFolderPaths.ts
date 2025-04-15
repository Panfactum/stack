import { readdir } from "fs/promises";
import { CLIError } from "../error/error";

export async function getDelegatedZonesFolderPaths({
  environmentDir,
}: {
  environmentDir: string;
}) {
  const delegatedZonesFolders: { path: string; folderName: string }[] = [];

  try {
    // Get all environment directories
    const entries = await readdir(environmentDir, { withFileTypes: true });
    const envDirs = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    // Check each environment directory
    for (const envName of envDirs) {
      const envPath = `${environmentDir}/${envName}`;

      // Get all folders in this environment directory
      const envSubEntries = await readdir(envPath, { withFileTypes: true });

      const subDirs = envSubEntries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);

      // Check each region directory
      for (const subDir of subDirs) {
        const regionDirPath = `${envPath}/${subDir}`;

        // Get all folders in this region directory
        const regionSubEntries = await readdir(regionDirPath, {
          withFileTypes: true,
        });

        // Get all folders in this region directory
        const zoneSubEntries = regionSubEntries
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name);

        // Look for aws_delegated_zones_ prefixed folders
        for (const zone of zoneSubEntries) {
          if (zone.startsWith("aws_delegated_zones_")) {
            delegatedZonesFolders.push({
              path: `${envPath}/${subDir}/${zone}`,
              folderName: `${zone}`,
            });
          }
        }
      }
    }
  } catch (error) {
    throw new CLIError("Failed to find delegated zones folders", error);
  }

  return delegatedZonesFolders;
}
