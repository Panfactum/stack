// This file provides utilities for reading AWS credentials from the credentials file
// It handles both static and temporary (session-based) credentials

import { join } from "node:path"
import { parse } from "ini"
import { z } from "zod"
import { CLIError, PanfactumZodError } from "@/util/error/error"
import { fileExists } from "@/util/fs/fileExists"
import { AWS_ACCESS_KEY_ID_SCHEMA, AWS_SECRET_KEY_SCHEMA } from "./schemas"
import type { PanfactumContext } from "@/util/context/context"

/**
 * Interface for getCredsFromFile function output - AWS credentials payload
 */
interface IGetCredsFromFileOutput {
    /** AWS access key ID */
    accessKeyId: string;
    /** AWS secret access key */
    secretAccessKey: string;
    /** AWS session token for temporary credentials (only present for temporary credentials) */
    sessionToken?: string;
}

/**
 * Input parameters for getting credentials from file
 */
interface IGetCredsFromFileInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** AWS profile name to retrieve credentials for */
  profile: string;
}

/**
 * Retrieves AWS credentials from the credentials file for a specific profile
 * 
 * @remarks
 * This function reads and parses the AWS credentials file, extracting
 * credentials for the specified profile. It supports both static credentials
 * (access key and secret) and temporary credentials (with session token).
 * The function validates the credentials format using Zod schemas to ensure
 * they meet AWS requirements.
 * 
 * @param inputs - Configuration including context and profile name
 * @returns Credentials payload if found, undefined if profile doesn't exist
 * 
 * @example
 * ```typescript
 * const creds = await getCredsFromFile({
 *   context,
 *   profile: 'production'
 * });
 * if (creds) {
 *   console.log(`Found credentials for profile`);
 *   if ('sessionToken' in creds) {
 *     console.log('Using temporary credentials');
 *   }
 * }
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when unable to read the credentials file
 * 
 * @throws {@link PanfactumZodError}
 * Throws when credentials format is invalid or doesn't match schema
 * 
 * @see {@link AWS_ACCESS_KEY_ID_SCHEMA} - For access key validation
 * @see {@link AWS_SECRET_KEY_SCHEMA} - For secret key validation
 */
export async function getCredsFromFile(inputs: IGetCredsFromFileInput): Promise<IGetCredsFromFileOutput | undefined> {
    const { context, profile } = inputs

    const credsFilePath = join(context.repoVariables.aws_dir, "credentials")

    if (!await fileExists({ filePath: credsFilePath })) {
        return undefined
    }

    // Read and parse the credentials file
    const fileContent = await Bun.file(credsFilePath).text()
        .catch((error: unknown) => {
            throw new CLIError(`Unable to read credentials file at ${credsFilePath}`, error)
        })
    
    const parsedCredentials = parse(fileContent)

    // Validate the credentials structure
    const credentialsSchema = z.object({
        [profile]: z.object({
            aws_access_key_id: AWS_ACCESS_KEY_ID_SCHEMA,
            aws_secret_access_key: AWS_SECRET_KEY_SCHEMA,
            aws_session_token: z.string().optional()
        }).optional()
    })

    const parseResult = credentialsSchema.safeParse(parsedCredentials)
    if (!parseResult.success) {
        throw new PanfactumZodError(
            `Invalid credentials format for profile '${profile}'`,
            credsFilePath,
            parseResult.error
        )
    }
    const validatedCredentials = parseResult.data

    const creds = validatedCredentials[profile]
    if (creds) {
        // This is necessary, otherwise the AWS SDK
        // will be borked by the presence of an undefined sessionToken
        if (creds.aws_session_token) {
            return {
                accessKeyId: creds.aws_access_key_id,
                secretAccessKey: creds.aws_secret_access_key,
                sessionToken: creds.aws_session_token
            }
        } else {
            return {
                accessKeyId: creds.aws_access_key_id,
                secretAccessKey: creds.aws_secret_access_key,
            }
        }
    } else {
        return undefined
    }
}