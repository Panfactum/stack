// This file provides utilities for checking if files contain specific patterns
// It efficiently scans files line-by-line without loading the entire content into memory

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { CLIError } from "@/util/error/error";
import { fileExists } from "./fileExists";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Interface for fileContains function inputs
 */
interface IFileContainsInputs {
  /** Panfactum context for logging (optional) */
  context?: PanfactumContext;
  /** Path to the file to search */
  filePath: string;
  /** Regular expression pattern to match */
  regex: RegExp;
  /** Whether to throw error if file doesn't exist */
  throwIfMissing?: boolean;
}

/**
 * Checks if a file contains any line that matches the provided regex pattern
 * 
 * @remarks
 * This function efficiently searches through files by processing them line by line
 * rather than loading the entire file content into memory. This makes it suitable
 * for searching through large files without causing memory issues.
 * 
 * Key features:
 * - **Memory Efficient**: Streams file content line by line
 * - **Fast Exit**: Returns immediately when first match is found
 * - **Regex Support**: Uses full JavaScript regex capabilities
 * - **Error Handling**: Graceful handling of missing files
 * 
 * Common use cases:
 * - Checking configuration files for specific settings
 * - Verifying log files contain expected entries
 * - Searching source code for patterns
 * - Validating generated files
 * 
 * The function supports both throwing errors for missing files or returning false,
 * allowing for flexible error handling strategies based on the use case.
 * 
 * @param inputs - Configuration for file pattern search
 * @returns True if the pattern is found, false otherwise
 * 
 * @example
 * ```typescript
 * // Check if a config file contains a setting
 * const hasFeature = await fileContains({
 *   filePath: '/path/to/config.txt',
 *   regex: /enable_feature=true/
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Check with error throwing for missing files
 * const hasError = await fileContains({
 *   context,
 *   filePath: '/var/log/app.log',
 *   regex: /ERROR:/,
 *   throwIfMissing: true
 * });
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when throwIfMissing is true and the file doesn't exist
 * 
 * @throws {@link CLIError}
 * Throws when file reading operations fail due to permissions or I/O errors
 * 
 * @see {@link fileExists} - For checking file existence
 */
export const fileContains = async (inputs: IFileContainsInputs): Promise<boolean> => {
  const { filePath, regex, throwIfMissing } = inputs;

  if (!await fileExists({ filePath })) {
    if (throwIfMissing) {
      throw new CLIError(`Cannot run fileContains on nonexistent file ${filePath}`);
    } else {
      return false;
    }
  }

  try {
    // Create a readable stream for the file
    const fileStream = createReadStream(filePath);

    // Create a readline interface for processing line by line
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    // Process each line
    for await (const line of rl) {
      if (regex.test(line)) {
        rl.close();
        fileStream.close();
        return true;
      }
    }

    return false;
  } catch (e) {
    throw new CLIError(`Error checking if file ${filePath} contains pattern`, e);
  }
};
