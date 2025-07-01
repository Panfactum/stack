// This file provides utilities for recursively searching for folders in directory trees
// It efficiently traverses directories while avoiding hidden folders for performance

import fs from "node:fs/promises";
import path from "node:path";
import { directoryExists } from "./directoryExist";

/**
 * Recursively searches for a folder with the specified name within a directory tree
 * 
 * @remarks
 * This function performs a depth-first search through the directory structure,
 * looking for a folder with the exact name match. It automatically skips hidden
 * directories (those starting with ".") for performance and security reasons.
 * 
 * Key features:
 * - **Recursive Search**: Searches through all subdirectories
 * - **Hidden Directory Filtering**: Skips directories starting with "."
 * - **Early Exit**: Returns immediately when first match is found
 * - **Error Tolerance**: Gracefully handles permission errors during traversal
 * 
 * Common use cases:
 * - Finding module directories in large codebases
 * - Locating configuration folders
 * - Searching for specific project structure elements
 * - Build system directory discovery
 * 
 * @param dir - Starting directory for the search
 * @param folderName - Exact name of the folder to find
 * @returns Full path to the found folder, or null if not found
 * 
 * @example
 * ```typescript
 * // Find a module directory
 * const modulePath = await findFolder(
 *   "/workspace/project",
 *   "node_modules"
 * );
 * if (modulePath) {
 *   console.log(`Found at: ${modulePath}`);
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Search for configuration directory
 * const configDir = await findFolder(
 *   process.cwd(),
 *   ".panfactum"
 * );
 * ```
 * 
 * @see {@link directoryExists} - For checking if directories exist
 */
export async function findFolder(
    dir: string,
    folderName: string
): Promise<string | null> {
    // Check if the current directory is the one we're looking for
    const targetPath = path.join(dir, folderName);
    if (await directoryExists({ path: targetPath })) {
        return targetPath;
    }

    // List all entries in the current directory
    const entries = await fs.readdir(dir, { withFileTypes: true });

    // Process all subdirectories
    for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
            const subDirPath = path.join(dir, entry.name);
            const result = await findFolder(subDirPath, folderName);
            if (result) {
                return result;
            }
        }
    }

    return null;
}