// This file provides utilities for finding the git repository root
// It uses git commands to locate the top-level directory of the repository

import { CLIError } from '@/util/error/error';

/**
 * Finds the root directory of the git repository containing the given path
 * 
 * @remarks
 * This function uses `git rev-parse --show-toplevel` to find the repository
 * root. It's essential for locating configuration files and determining
 * relative paths within the Panfactum project structure.
 * 
 * The function requires that the current working directory is inside a git
 * repository. This is a fundamental requirement for Panfactum projects.
 * 
 * @param cwd - Directory to start searching from (must be inside a git repo)
 * @returns Absolute path to the repository root directory
 * 
 * @example
 * ```typescript
 * const repoRoot = await getRoot(process.cwd());
 * console.log(`Repository root: ${repoRoot}`);
 * // Output: /home/user/my-panfactum-project
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when the directory is not inside a git repository
 * 
 * @throws {@link CLIError}
 * Throws when the git command fails for any reason
 * 
 * @see {@link getDevshellConfig} - Uses this to locate configuration files
 */
export async function getRoot(cwd: string): Promise<string> {
  const proc = Bun.spawn(["git", "rev-parse", "--show-toplevel"], {
    cwd,
    stderr: "pipe"
  })

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new globalThis.Response(proc.stderr).text();
    throw new CLIError(`Failed to get repository root: ${stderr.trim() || 'git command failed'}`);
  }
  
  const stdout = await new globalThis.Response(proc.stdout).text();
  return stdout.trim();
}