// Utility for creating temporary test directories in tests
// Provides a consistent way to create uniquely named test directories

import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Interface for the input parameters to createTestDir
 */
interface ICreateTestDirInput {
  /** The name of the function being tested */
  functionName: string;
}

/**
 * Interface for the output of createTestDir
 */
interface ICreateTestDirOutput {
  /** The absolute path to the created test directory */
  path: string;
}

/**
 * Creates a unique temporary directory for testing purposes
 *
 * @remarks
 * This function creates a temporary directory with a unique name based on the function name,
 * current timestamp, and a random string. The directory is created under the system's temporary
 * directory and should be cleaned up after use.
 *
 * @param input - The input parameters containing the function name. See {@link ICreateTestDirInput}
 * @returns The path to the created directory. See {@link ICreateTestDirOutput}
 *
 * @example
 * ```typescript
 * const { path: testDir } = await createTestDir({ functionName: "getDomains" });
 * try {
 *   // Use testDir for your test
 * } finally {
 *   await rm(testDir, { recursive: true, force: true });
 * }
 * ```
 */
export async function createTestDir(input: ICreateTestDirInput): Promise<ICreateTestDirOutput> {
  const { functionName } = input;
  const dirName = `${functionName}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const dirPath = join(tmpdir(), dirName);
  
  await mkdir(dirPath, { recursive: true });
  
  return { path: dirPath };
}