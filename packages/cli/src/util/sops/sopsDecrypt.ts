// This file provides utilities for decrypting SOPS-encrypted files
// It handles secure secret management with schema validation

import { dirname } from "node:path";
import { type z } from "zod";
import { CLIError, PanfactumZodError } from "@/util/error/error";
import { fileExists } from "@/util/fs/fileExists";
import { execute } from "@/util/subprocess/execute";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for decrypting SOPS files
 */
interface ISopsDecryptInput<T extends z.ZodType<object>> {
  /** Path to the SOPS-encrypted file */
  filePath: string;
  /** Panfactum context for configuration and logging */
  context: PanfactumContext;
  /** Zod schema to validate decrypted data */
  validationSchema: T;
  /** Whether to throw error if file is missing */
  throwOnMissing?: boolean;
}

/**
 * Decrypts a SOPS-encrypted file and validates its contents
 * 
 * @remarks
 * This function provides secure decryption of SOPS (Secrets OPerationS)
 * encrypted files with automatic schema validation. SOPS is used throughout
 * Panfactum for managing sensitive configuration data.
 * 
 * Security features:
 * - Uses SOPS for encryption/decryption with cloud KMS
 * - Validates decrypted data against expected schema
 * - Handles missing files gracefully
 * - Provides clear error messages without exposing secrets
 * 
 * The decryption process:
 * 1. Verifies the encrypted file exists
 * 2. Runs SOPS decrypt with JSON output
 * 3. Parses the decrypted JSON
 * 4. Validates against provided Zod schema
 * 
 * SOPS integration:
 * - Automatically uses AWS KMS, GCP KMS, or age keys
 * - Respects SOPS configuration in .sops.yaml
 * - Handles key rotation transparently
 * - Supports multi-key encryption
 * 
 * Common use cases:
 * - Decrypting environment secrets
 * - Loading encrypted configuration
 * - Retrieving API keys and passwords
 * - Managing certificate data
 * 
 * @param input - Decryption configuration
 * @returns Decrypted and validated data, or null if file missing
 * 
 * @example
 * ```typescript
 * // Decrypt database credentials
 * const DbCredsSchema = z.object({
 *   username: z.string(),
 *   password: z.string(),
 *   host: z.string()
 * });
 * 
 * const creds = await sopsDecrypt({
 *   filePath: './secrets/db.sops.json',
 *   context,
 *   validationSchema: DbCredsSchema,
 *   throwOnMissing: true
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Decrypt optional configuration
 * const config = await sopsDecrypt({
 *   filePath: './config/optional.sops.yaml',
 *   context,
 *   validationSchema: ConfigSchema,
 *   throwOnMissing: false // Returns null if missing
 * });
 * 
 * if (config) {
 *   applyConfiguration(config);
 * }
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when file is missing (if throwOnMissing is true)
 * 
 * @throws {@link CLIError}
 * Throws when SOPS decryption fails
 * 
 * @throws {@link CLIError}
 * Throws when decrypted data is not valid JSON
 * 
 * @throws {@link PanfactumZodError}
 * Throws when decrypted data doesn't match schema
 * 
 * @see {@link sopsEncrypt} - For encrypting data
 * @see {@link execute} - For running SOPS command
 */
export const sopsDecrypt = async <T extends z.ZodType<object>>(
  input: ISopsDecryptInput<T>
) => {
  const { filePath, context, validationSchema, throwOnMissing } = input;

  if (!(await fileExists({ filePath }))) {
    if (throwOnMissing) {
      throw new CLIError(`sops-encrypted file does not exist at ${filePath}`);
    } else {
      return null;
    }
  }

  const { stdout } = await execute({
    command: ["sops", "-d", "--output-type", "json", filePath],
    context,
    workingDirectory: dirname(filePath),
  }).catch((error: unknown) => {
    throw new CLIError(`Failed to decrypt sops file at ${filePath}`, error);
  });

  // Parse JSON output
  let decryptedData: unknown;
  try {
    decryptedData = JSON.parse(stdout);
  } catch (error) {
    throw new CLIError(`Invalid JSON output from sops decrypt for file at ${filePath}`, error);
  }

  // Validate with schema
  const parseResult = validationSchema.safeParse(decryptedData);
  if (!parseResult.success) {
    throw new PanfactumZodError(
      "Decrypted sops data did not match expected schema",
      filePath,
      parseResult.error
    );
  }

  return parseResult.data as z.infer<T>;
};
