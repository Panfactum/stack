import type { BaseContext } from "clipanion";
import { readdir } from "fs/promises";
import pc from "picocolors";
import { writeErrorToDebugFile } from "./write-error-to-debug-file";

export async function getDelegatedZonesFolderPaths({
  environmentDir,
  context,
  verbose = false,
}: {
  environmentDir: string;
  context: BaseContext;
  verbose?: boolean;
}) {
  const delegatedZonesFolders: { path: string; folderName: string }[] = [];

  try {
    // Get all environment directories
    const entries = await readdir(environmentDir, { withFileTypes: true });
    if (verbose) {
      context.stdout.write(`entries: ${JSON.stringify(entries, null, 2)}\n`);
    }
    const envDirs = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    if (verbose) {
      context.stdout.write(`envDirs: ${JSON.stringify(envDirs, null, 2)}\n`);
    }

    // Check each environment directory
    for (const envName of envDirs) {
      const envPath = `${environmentDir}/${envName}`;
      if (verbose) {
        context.stdout.write(`envPath: ${envPath}\n`);
      }

      // Get all folders in this environment directory
      const envSubEntries = await readdir(envPath, { withFileTypes: true });
      if (verbose) {
        context.stdout.write(
          `envSubEntries: ${JSON.stringify(envSubEntries, null, 2)}\n`
        );
      }
      const subDirs = envSubEntries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
      if (verbose) {
        context.stdout.write(`subDirs: ${JSON.stringify(subDirs, null, 2)}\n`);
      }

      // Check each region directory
      for (const subDir of subDirs) {
        const regionDirPath = `${envPath}/${subDir}`;
        if (verbose) {
          context.stdout.write(`regionDirPath: ${regionDirPath}\n`);
        }

        // Get all folders in this region directory
        const regionSubEntries = await readdir(regionDirPath, {
          withFileTypes: true,
        });
        if (verbose) {
          context.stdout.write(
            `regionSubEntries: ${JSON.stringify(regionSubEntries, null, 2)}\n`
          );
        }

        // Get all folders in this region directory
        const zoneSubEntries = regionSubEntries
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name);
        if (verbose) {
          context.stdout.write(
            `zoneSubEntries: ${JSON.stringify(zoneSubEntries, null, 2)}\n`
          );
        }

        // Look for aws_delegated_zones_ prefixed folders
        for (const zone of zoneSubEntries) {
          if (zone.startsWith("aws_delegated_zones_")) {
            if (verbose) {
              context.stdout.write(`zone: ${zone}\n`);
            }
            delegatedZonesFolders.push({
              path: `${envPath}/${subDir}/${zone}`,
              folderName: `${zone}`,
            });
          }
        }
      }
    }
  } catch (error) {
    writeErrorToDebugFile({
      context,
      error,
    });
    const errorMessage =
      error instanceof Error
        ? `Error finding delegated zones folders: ${error.message}`
        : "Error finding delegated zones folders";
    context.stderr.write(`${pc.red(errorMessage)}\n`);
    throw new Error("Failed to find delegated zones folders");
  }

  if (verbose) {
    context.stdout.write(
      `delegatedZonesFolders: ${JSON.stringify(delegatedZonesFolders, null, 2)}\n`
    );
  }

  return delegatedZonesFolders;
}
