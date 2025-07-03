// This file provides utilities for retrieving outputs from Terragrunt modules
// It executes terragrunt output and validates the results against schemas

import { join } from "node:path"
import { z } from "zod";
import { getIdentity } from "@/util/aws/getIdentity";
import { getPanfactumConfig } from "@/util/config/getPanfactumConfig";
import { CLIError, PanfactumZodError } from "@/util/error/error";
import { execute } from "@/util/subprocess/execute";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for retrieving Terragrunt outputs
 */
interface ITerragruntOutputInput<T extends z.ZodType<object>> {
  /** AWS profile to use (optional, will be inferred from config) */
  awsProfile?: string;
  /** Panfactum context for configuration */
  context: PanfactumContext;
  /** Additional environment variables for Terragrunt */
  env?: Record<string, string | undefined>;
  /** Name of the environment */
  environment: string;
  /** Name of the region */
  region: string;
  /** Name of the module */
  module: string;
  /** Zod schema for validating the output structure */
  validationSchema: T;
}

/**
 * Retrieves and validates outputs from a deployed Terragrunt module
 * 
 * @remarks
 * This function executes `terragrunt output --json` to retrieve outputs
 * from a deployed module's state file. It provides type-safe access to
 * module outputs by:
 * 
 * 1. **AWS Authentication**: Ensures AWS credentials are available by:
 *    - Using provided AWS profile or inferring from config
 *    - Validating credentials with getIdentity
 * 
 * 2. **Output Retrieval**: Runs terragrunt output to get:
 *    - All outputs defined in the module
 *    - Values from the current state file
 *    - JSON formatted for parsing
 * 
 * 3. **Type Validation**: Uses Zod schema to:
 *    - Validate output structure
 *    - Ensure type safety
 *    - Provide detailed error messages
 * 
 * Common use cases:
 * - Getting resource IDs for cross-module references
 * - Retrieving connection strings and endpoints
 * - Accessing generated passwords or keys
 * - Building dependency chains between modules
 * 
 * @param input - Configuration for retrieving outputs
 * @returns Validated module outputs matching the schema type
 * 
 * @example
 * ```typescript
 * const VpcOutputSchema = z.object({
 *   vpc_id: z.object({ value: z.string() }),
 *   subnet_ids: z.object({ value: z.array(z.string()) })
 * });
 * 
 * const outputs = await terragruntOutput({
 *   context,
 *   environment: 'production',
 *   region: 'us-east-1',
 *   module: 'aws_vpc',
 *   validationSchema: VpcOutputSchema
 * });
 * 
 * console.log(`VPC ID: ${outputs.vpc_id.value}`);
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when AWS authentication fails
 * 
 * @throws {@link CLISubprocessError}
 * Throws when terragrunt output command fails
 * 
 * @throws {@link CLIError}
 * Throws when output is not valid JSON
 * 
 * @throws {@link PanfactumZodError}
 * Throws when outputs don't match the validation schema
 * 
 * @see {@link terragruntApply} - Must be run before outputs are available
 * @see {@link getIdentity} - For AWS credential validation
 */
export const terragruntOutput = async <T extends z.ZodType<object>>(
  input: ITerragruntOutputInput<T>
): Promise<z.infer<T>> => {
  const { awsProfile, context, env, environment, region, module, validationSchema } = input;
  const workingDirectory = join(context.devshellConfig.environments_dir, environment, region, module)

  let profileToUse = awsProfile;
  if (!profileToUse) {
    const config = await getPanfactumConfig({ context, directory: workingDirectory })
    profileToUse = config.aws_profile
  }

  if (profileToUse) {
    await getIdentity({ context, profile: profileToUse })
  }

  const { stdout } = await execute({
    command: [
      "terragrunt",
      "output",
      "--json",
      "--terragrunt-non-interactive"
    ],
    env,
    workingDirectory,
    context,
    errorMessage: "Failed to get outputs from infrastructure module",
  });

  // Parse JSON output
  let parsedOutput: unknown;
  try {
    parsedOutput = JSON.parse(stdout);
  } catch (error) {
    throw new CLIError(
      `Invalid JSON output from infrastructure module at ${workingDirectory}`,
      error
    );
  }

  // Validate output structure
  const parseResult = validationSchema.safeParse(parsedOutput);
  if (!parseResult.success) {
    throw new PanfactumZodError(
      `Unexpected outputs from infrastructure module`,
      workingDirectory,
      parseResult.error
    );
  }

  return parseResult.data as z.infer<T>;
};
