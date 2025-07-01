// This file provides utilities for caching Docker registry credentials
// It implements credential caching to reduce authentication overhead

import { join } from 'path'
import { z } from 'zod'
import { CLIError } from '@/util/error/error'
import { createDirectory } from '@/util/fs/createDirectory'
import { writeFile } from '@/util/fs/writeFile'
import { readJSONFile } from '@/util/json/readJSONFile'
import type { PanfactumContext } from '@/util/context/context'

/**
 * Zod schema for validating cached Docker registry credentials
 * 
 * @remarks
 * Defines the structure of individual credential entries in the cache.
 * Each entry contains an authentication token and expiration timestamp.
 */
const cachedCredentialSchema = z.object({
  /** Base64-encoded authentication token for Docker registry */
  token: z.string().describe("Base64 Docker auth token"),
  /** Unix timestamp (seconds) when the credential expires */
  expires: z.string().describe("Expiration timestamp")
}).describe("Cached Docker credential entry")

/**
 * Zod schema for validating the Docker credentials cache file
 * 
 * @remarks
 * Validates the structure of creds.json which maps registry URLs
 * to their cached credentials. This enables efficient credential
 * reuse across multiple Docker operations.
 */
const credentialsFileSchema = z.record(cachedCredentialSchema)
  .describe("Docker credentials cache file schema")

type CredentialsFile = z.infer<typeof credentialsFileSchema>

/** Cache time-to-live in milliseconds (4 hours) */
const CACHE_TTL = 4 * 60 * 60 * 1000

/**
 * Gets the path to the credentials cache file
 * 
 * @internal
 * @param context - Panfactum context
 * @returns Path to creds.json file
 */
async function getCredsFilePath(context: PanfactumContext): Promise<string> {
  const buildkitDir = context.repoVariables.buildkit_dir
  return join(buildkitDir, 'creds.json')
}

/**
 * Reads the credentials cache file
 * 
 * @internal
 * @param context - Panfactum context
 * @returns Parsed credentials file or empty object
 */
async function readCredsFile(context: PanfactumContext): Promise<CredentialsFile> {
  const credsFile = await getCredsFilePath(context)
  
  const result = await readJSONFile({
    context,
    filePath: credsFile,
    validationSchema: credentialsFileSchema,
    throwOnMissing: false,
    throwOnEmpty: false
  })
  
  return result || {}
}

/**
 * Writes the credentials cache file
 * 
 * @internal
 * @param context - Panfactum context
 * @param creds - Credentials to write
 */
async function writeCredsFile(context: PanfactumContext, creds: CredentialsFile): Promise<void> {
  const credsFile = await getCredsFilePath(context)
  const buildkitDir = context.repoVariables.buildkit_dir
  
  // Ensure buildkit directory exists
  await createDirectory({ dirPath: buildkitDir })
    .catch((error: unknown) => {
      throw new CLIError(
        `Failed to create directory ${buildkitDir}`,
        error
      )
    })
  
  // Write credentials file
  await writeFile({
    context,
    filePath: credsFile,
    contents: JSON.stringify(creds, null, 2),
    overwrite: true
  }).catch((error: unknown) => {
    throw new CLIError(
      `Failed to write Docker credentials cache to ${credsFile}`,
      error
    )
  })
}

/**
 * Input parameters for retrieving cached Docker credentials
 */
interface IGetCachedCredentialInput {
  /** Panfactum context for configuration and logging */
  context: PanfactumContext;
  /** Docker registry URL to retrieve credentials for */
  registry: string;
}

/**
 * Retrieves cached Docker registry credentials if still valid
 * 
 * @remarks
 * This function implements a credential caching mechanism to avoid
 * repeated authentication calls to Docker registries. It:
 * 
 * - Checks for existing cached credentials
 * - Validates expiration timestamps
 * - Returns valid tokens for reuse
 * - Cleans up expired entries automatically
 * 
 * The cache helps optimize:
 * - ECR token generation (reduces AWS API calls)
 * - Build performance (faster authentication)
 * - CI/CD pipelines (fewer auth failures)
 * - Rate limit management
 * 
 * Cached credentials are stored in:
 * `{buildkit_dir}/creds.json`
 * 
 * @param input - Configuration for credential retrieval
 * @returns Base64 auth token if valid cache exists, null otherwise
 * 
 * @example
 * ```typescript
 * const token = await getCachedCredential({
 *   context,
 *   registry: '123456789.dkr.ecr.us-east-1.amazonaws.com'
 * });
 * 
 * if (token) {
 *   // Use cached token
 *   await docker.push({ auth: token });
 * } else {
 *   // Generate new token
 *   const newToken = await getECRToken();
 * }
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when cached timestamp has invalid format
 * 
 * @see {@link setCachedCredential} - For storing credentials
 * @see {@link CACHE_TTL} - Default cache duration (4 hours)
 */
export async function getCachedCredential(
  input: IGetCachedCredentialInput
): Promise<string | null> {
  const { context, registry } = input;
  
  const creds = await readCredsFile(context)
  const cached = creds[registry]
  
  if (!cached) {
    return null
  }
  
  // Check if credential is expired
  const expiresTimestamp = parseInt(cached.expires, 10)
  if (isNaN(expiresTimestamp)) {
    throw new CLIError(`Invalid expiration timestamp for cached credential: ${cached.expires}`)
  }
  
  const now = Date.now()
  if (now >= expiresTimestamp) {
    // Credential is expired, remove it
    delete creds[registry]
    await writeCredsFile(context, creds)
    return null
  }
  
  return cached.token
}

/**
 * Input parameters for caching Docker credentials
 */
interface ISetCachedCredentialInput {
  /** Panfactum context for configuration and logging */
  context: PanfactumContext;
  /** Docker registry URL to cache credentials for */
  registry: string;
  /** Base64-encoded authentication token */
  token: string;
}

/**
 * Stores Docker registry credentials in the local cache
 * 
 * @remarks
 * This function saves authentication tokens for Docker registries
 * with automatic expiration management. Features include:
 * 
 * - Atomic file updates (overwrites entire cache)
 * - 4-hour default expiration time
 * - Registry-specific credential storage
 * - Automatic directory creation
 * 
 * The cache structure allows:
 * - Multiple registry credentials
 * - Independent expiration times
 * - Easy credential rotation
 * - Secure local storage
 * 
 * Common use cases:
 * - Caching ECR tokens after generation
 * - Storing private registry credentials
 * - Reducing authentication overhead
 * - Improving build performance
 * 
 * @param input - Configuration for credential caching
 * 
 * @example
 * ```typescript
 * // Cache ECR token
 * const ecrToken = await getECRAuthToken();
 * await setCachedCredential({
 *   context,
 *   registry: '123456789.dkr.ecr.us-east-1.amazonaws.com',
 *   token: ecrToken
 * });
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when directory creation fails
 * 
 * @throws {@link CLIError}
 * Throws when credential file write fails
 * 
 * @see {@link getCachedCredential} - For retrieving cached tokens
 * @see {@link CACHE_TTL} - Cache duration constant
 */
export async function setCachedCredential(
  input: ISetCachedCredentialInput
): Promise<void> {
  const { context, registry, token } = input;
  
  const creds = await readCredsFile(context)
  const expiresAt = Date.now() + CACHE_TTL
  
  creds[registry] = {
    token,
    expires: expiresAt.toString()
  }
  
  await writeCredsFile(context, creds)
}