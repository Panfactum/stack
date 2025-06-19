import { CLIError } from '@/util/error/error';

/**
 * Gets the repository root
 * @returns An absolute path to the repository root
 */
export async function getRoot(cwd: string): Promise<string> {
  const proc = Bun.spawn(["git", "rev-parse", "--show-toplevel"], {cwd})

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new globalThis.Response(proc.stderr).text();
    throw new CLIError(`Failed to get repository root: ${stderr.trim() || 'git command failed'}`);
  }
  
  const stdout = await new globalThis.Response(proc.stdout).text();
  return stdout.trim();
}