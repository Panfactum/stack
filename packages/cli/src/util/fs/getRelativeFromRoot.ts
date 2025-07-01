// This file provides utilities for converting absolute paths to relative paths from repository root
// It helps normalize file paths for consistent display and logging

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
    return path.replace(new RegExp(`^${context.repoVariables.repo_root}/?`), '');
}