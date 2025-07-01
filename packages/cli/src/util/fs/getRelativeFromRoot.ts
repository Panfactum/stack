// This file provides utilities for converting absolute paths to relative paths from repository root
// It helps normalize file paths for consistent display and logging

import { relative } from "node:path";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for getting relative path from repository root
 */
interface IGetRelativeFromRootInput {
  /** Panfactum context containing repository root information */
  context: PanfactumContext;
  /** Absolute path to convert to relative path */
  path: string;
}

/**
 * Converts an absolute path to a relative path from the repository root
 * 
 * @remarks
 * This function removes the repository root prefix from an absolute path,
 * creating a relative path that can be used for consistent display and
 * logging across the CLI. It's particularly useful for:
 * 
 * - Normalizing file paths in error messages
 * - Creating portable path references
 * - Simplifying path display in logs and output
 * - Ensuring consistent path formatting
 * 
 * The function handles both trailing slash variations and ensures
 * clean relative paths without leading separators.
 * 
 * @param input - Configuration including context and absolute path
 * @returns Relative path from repository root
 * 
 * @example
 * ```typescript
 * // Convert absolute path to relative
 * const relativePath = getRelativeFromRoot({
 *   context,
 *   path: '/home/user/project/src/components/Button.tsx'
 * });
 * console.log(relativePath); // "src/components/Button.tsx"
 * ```
 * 
 * @example
 * ```typescript
 * // Use in error messages for cleaner output
 * const cleanPath = getRelativeFromRoot({
 *   context,
 *   path: absoluteFilePath
 * });
 * throw new CLIError(`Error in file: ${cleanPath}`);
 * ```
 */
export function getRelativeFromRoot({ context, path }: IGetRelativeFromRootInput): string {
    const repoRoot = context.repoVariables.repo_root;
    
    // Normalize repo root by removing trailing slash
    const normalizedRepoRoot = repoRoot.endsWith('/') ? repoRoot.slice(0, -1) : repoRoot;
    
    // Check if the path starts with the repo root
    if (path === normalizedRepoRoot || path === normalizedRepoRoot + '/') {
        return '';
    }
    
    if (path.startsWith(normalizedRepoRoot + '/')) {
        return path.slice(normalizedRepoRoot.length + 1);
    }
    
    // Path is not within the repo root - return relative path
    return relative(normalizedRepoRoot, path);
}