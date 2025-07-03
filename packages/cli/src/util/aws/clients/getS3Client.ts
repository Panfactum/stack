// This file provides a factory function for creating AWS S3 clients
// It uses the generic AWS client factory for consistent credential handling

import { S3Client } from "@aws-sdk/client-s3";
import { createAWSClient } from "@/util/aws/clients/createAWSClient";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for creating an S3 client
 */
interface IGetS3ClientInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** AWS profile name to use for credentials */
  profile: string;
  /** AWS region for the client */
  region: string;
}

/**
 * Creates an AWS S3 client with proper credential handling
 * 
 * @remarks
 * This function creates an S3Client using the generic AWS client factory
 * which handles credential loading and works around AWS SDK bug
 * https://github.com/aws/aws-sdk-js-v3/issues/6872.
 * 
 * @param inputs - Configuration for the S3 client
 * @returns Configured AWS S3 client
 * 
 * @example
 * ```typescript
 * const s3Client = await getS3Client({
 *   context,
 *   profile: 'production',
 *   region: 'us-west-2'
 * });
 * 
 * const buckets = await s3Client.send(new ListBucketsCommand({}));
 * ```
 * 
 * @see {@link createAWSClient} - Generic AWS client factory
 * @see {@link S3Client} - AWS SDK S3 client documentation
 */
export async function getS3Client(inputs: IGetS3ClientInput): Promise<S3Client> {
    return createAWSClient({
        clientClass: S3Client
        // No defaultRegion - S3 requires explicit region specification
    }, inputs);
}