import { GetAuthorizationTokenCommand } from '@aws-sdk/client-ecr';
import { GetAuthorizationTokenCommand as GetPublicAuthCommand } from '@aws-sdk/client-ecr-public';
import { z, ZodError } from 'zod';
import { CLIError, PanfactumZodError } from '@/util/error/error';
import { getCachedCredential, setCachedCredential } from './credentialCache';
import { getECRClient } from '../aws/clients/getECRClient';
import { getECRPublicClient } from '../aws/clients/getECRPublicClient';
import type { PanfactumContext } from '@/util/context/context'


/**
 * Zod schema for parsing and validating ECR authorization tokens
 * 
 * @remarks
 * ECR tokens are base64-encoded strings in the format "username:password".
 * This schema decodes the token and extracts the credentials for Docker
 * authentication. The schema validates:
 * - Base64 encoding is valid
 * - Decoded format contains exactly one colon separator
 * - Both username and password are non-empty
 * 
 * ECR tokens typically have:
 * - Username: "AWS"
 * - Password: Temporary authentication token
 */
const ecrTokenSchema = z.string().transform((token, ctx) => {
  const decoded = globalThis.Buffer.from(token, 'base64').toString('utf8');
  const parts = decoded.split(':');
  
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid ECR token format: expected base64 encoded username:password'
    });
    return z.NEVER;
  }
  
  return { username: parts[0], password: parts[1] };
}).describe("ECR authorization token parser")

/**
 * Options for retrieving ECR authentication tokens
 */
export interface IGetECRTokenOptions {
  /** Panfactum context for configuration and logging */
  context: PanfactumContext
  /** ECR registry URL (e.g., "123456789.dkr.ecr.us-east-1.amazonaws.com") */
  registry: string
  /** AWS profile to use for authentication */
  awsProfile: string
  /** Whether to skip credential caching (default: false) */
  skipCache?: boolean
}

/**
 * Interface for parseECRToken function output
 */
interface IParseECRTokenOutput {
  /** ECR username (typically "AWS") */
  username: string;
  /** ECR authentication password token */
  password: string;
}

/**
 * Parses an ECR authorization token to extract credentials
 * 
 * @remarks
 * This utility function decodes base64-encoded ECR tokens and
 * extracts the username and password components. ECR tokens
 * follow the format "username:password" encoded in base64.
 * 
 * Typical ECR tokens have:
 * - Username: "AWS" (constant)
 * - Password: Temporary token valid for 12 hours
 * 
 * This function is useful when you need the raw credentials
 * rather than the base64-encoded token.
 * 
 * @param token - Base64-encoded ECR authorization token
 * @returns Decoded username and password
 * 
 * @example
 * ```typescript
 * const token = "QVdTOmV5SnBkQ0k2..."; // Base64 token from ECR
 * const { username, password } = parseECRToken(token);
 * // username: "AWS"
 * // password: "eyJwdCI6..." (actual auth token)
 * ```
 * 
 * @throws {@link PanfactumZodError}
 * Throws when token format is invalid or cannot be decoded
 * 
 * @see {@link getECRToken} - For retrieving tokens from AWS
 */
export function parseECRToken(token: string): IParseECRTokenOutput {
  try {
    const result = ecrTokenSchema.parse(token);
    return result;
  } catch (error) {
    if (error instanceof ZodError) {
      throw new PanfactumZodError('Failed to parse ECR token', 'ECR token', error);
    }
    throw new CLIError('Failed to parse ECR token', error);
  }
}

/**
 * Retrieves an authorization token for AWS ECR (Elastic Container Registry)
 * 
 * @remarks
 * This function obtains temporary authentication tokens for Docker operations
 * with AWS ECR. It supports both private and public ECR registries with
 * intelligent caching to minimize AWS API calls.
 * 
 * Key features:
 * - **Credential Caching**: Tokens cached for 4 hours (configurable)
 * - **Multi-Region Support**: Extracts region from registry URL
 * - **Public Registry Support**: Handles public.ecr.aws endpoints
 * - **Profile-Based Auth**: Uses AWS profiles for authentication
 * 
 * Token characteristics:
 * - Valid for 12 hours from AWS
 * - Cached locally for 4 hours
 * - Base64-encoded "AWS:password" format
 * - Works with Docker CLI and BuildKit
 * 
 * Registry URL formats:
 * - Private: `{accountId}.dkr.ecr.{region}.amazonaws.com`
 * - Public: `public.ecr.aws/{alias}`
 * 
 * @param options - Configuration for token retrieval
 * @returns Base64-encoded authorization token for Docker
 * 
 * @example
 * ```typescript
 * // Get token for private ECR registry
 * const token = await getECRToken({
 *   context,
 *   registry: '123456789.dkr.ecr.us-east-1.amazonaws.com',
 *   awsProfile: 'production'
 * });
 * 
 * // Use with Docker
 * await docker.login({
 *   registry,
 *   username: 'AWS',
 *   password: token
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Get token for public ECR
 * const token = await getECRToken({
 *   context,
 *   registry: 'public.ecr.aws/mycompany',
 *   awsProfile: 'default',
 *   skipCache: true // Force fresh token
 * });
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when ECR client creation fails
 * 
 * @throws {@link CLIError}
 * Throws when token retrieval from AWS fails
 * 
 * @throws {@link CLIError}
 * Throws when no token is returned from AWS
 * 
 * @see {@link getCachedCredential} - For cache retrieval
 * @see {@link setCachedCredential} - For cache storage
 * @see {@link parseECRToken} - For decoding tokens
 */
export async function getECRToken(options: IGetECRTokenOptions): Promise<string> {
  const { context, registry, awsProfile, skipCache = false } = options;
  
  const cacheKey = `ecr-token-${registry}-${awsProfile}`;
  
  if (!skipCache) {
    const cachedToken = await getCachedCredential({
      context,
      registry: cacheKey
    });
    if (cachedToken) {
      context.logger.debug('Using cached ECR token', { registry });
      return cachedToken;
    }
  }
  
  const token = await fetchECRToken({
    context,
    registry,
    awsProfile
  });
  
  // Cache token (TTL is handled by setCachedCredential)
  await setCachedCredential({
    context,
    registry: cacheKey,
    token
  });
  
  return token;
}

/**
 * Interface for fetchECRToken function inputs
 */
interface IFetchECRTokenInputs {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** ECR registry URL */
  registry: string;
  /** AWS profile for authentication */
  awsProfile: string;
}

// Private function that contains the original token fetching logic
async function fetchECRToken(inputs: IFetchECRTokenInputs): Promise<string> {
  const { context, registry, awsProfile } = inputs;
  const isPublicRegistry = registry.includes('public.ecr.aws');
  
  if (isPublicRegistry) {
    // Use ECR Public client (public registry is always in us-east-1)
    const client = await getECRPublicClient({ context, profile: awsProfile })
      .catch((error: unknown) => {
        throw new CLIError(
          `Failed to create ECR Public client for profile '${awsProfile}'`,
          error
        );
      });
    
    context.logger.debug('Getting ECR public authorization token', { registry });
    const response = await client.send(new GetPublicAuthCommand({}))
      .catch((error: unknown) => {
        throw new CLIError(
          `Failed to get authorization token from ECR Public`,
          error
        );
      });
    
    if (!response.authorizationData?.authorizationToken) {
      throw new CLIError('No authorization token returned from ECR Public');
    }
    
    return response.authorizationData.authorizationToken;
  } else {
    // Extract region from registry URL (format: <accountId>.dkr.ecr.<region>.amazonaws.com)
    const regionMatch = registry.match(/\.ecr\.([^.]+)\.amazonaws\.com/);
    const region = regionMatch?.[1] ?? 'us-east-1';
    
    const client = await getECRClient({ context, profile: awsProfile, region })
      .catch((error: unknown) => {
        throw new CLIError(
          `Failed to create ECR client for profile '${awsProfile}' in region '${region}'`,
          error
        );
      });
    
    context.logger.debug('Getting ECR private authorization token', { registry, region });
    const response = await client.send(new GetAuthorizationTokenCommand({}))
      .catch((error: unknown) => {
        throw new CLIError(
          `Failed to get authorization token from ECR in region '${region}'`,
          error
        );
      });
    
    if (!response.authorizationData?.[0]?.authorizationToken) {
      throw new CLIError('No authorization token returned from ECR');
    }
    
    return response.authorizationData[0].authorizationToken;
  }
}