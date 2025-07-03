// This file provides a generic factory function for creating AWS service clients
// It centralizes credential handling logic to avoid code duplication across service-specific clients

import { getCredsFromFile } from "@/util/aws/getCredsFromFile";
import type { PanfactumContext } from "@/util/context/context";

/**
 * AWS client configuration type used by AWS SDK v3
 */
interface IAWSClientConfig {
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
  profile?: string;
  region?: string;
}

/**
 * Configuration for creating AWS clients with the factory
 * 
 * @template TClient - The AWS client type being created
 */
interface ICreateAWSClientConfig<TClient> {
  /** The AWS SDK client class/constructor */
  clientClass: new (config: IAWSClientConfig) => TClient;
  /** Default region to use if not specified in inputs */
  defaultRegion?: string;
}

/**
 * Input parameters for creating AWS clients
 */
interface ICreateAWSClientInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** AWS profile name to use for credentials */
  profile?: string;
  /** AWS region for the client */
  region?: string;
}

/**
 * Generic factory function for creating AWS service clients with proper credential handling
 * 
 * @remarks
 * This function provides a centralized way to create AWS SDK v3 clients with consistent
 * credential handling. It includes a workaround for AWS SDK bug
 * https://github.com/aws/aws-sdk-js-v3/issues/6872 by loading credentials
 * from files when a profile is specified.
 * 
 * @param config - Configuration including the client class and defaults
 * @param inputs - Runtime inputs including context, profile, and region
 * @returns Configured AWS client instance
 * 
 * @example
 * ```typescript
 * // Define a service-specific wrapper
 * export async function getS3Client(inputs: IGetS3ClientInput): Promise<S3Client> {
 *   return createAWSClient({
 *     clientClass: S3Client,
 *     defaultRegion: 'us-east-1'
 *   }, inputs);
 * }
 * 
 * // Use the service client
 * const s3Client = await getS3Client({
 *   context,
 *   profile: 'production',
 *   region: 'us-west-2'
 * });
 * ```
 * 
 * @see {@link getCredsFromFile} - For credential file loading
 */
export async function createAWSClient<TClient>(
  config: ICreateAWSClientConfig<TClient>,
  inputs: ICreateAWSClientInput
): Promise<TClient> {
  const { clientClass, defaultRegion = "us-east-1" } = config;
  const { context, profile, region = defaultRegion } = inputs;

  // This is necessary due to this bug
  // https://github.com/aws/aws-sdk-js-v3/issues/6872
  const credentials = profile ? await getCredsFromFile({ context, profile }) : undefined;

  if (credentials) {
    return new clientClass({
      credentials,
      region
    });
  } else {
    return new clientClass({
      profile: profile || undefined,
      region
    });
  }
}