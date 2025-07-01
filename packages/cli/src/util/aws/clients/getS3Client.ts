// This file provides a factory function for creating AWS S3 clients
// It handles credential loading from files to work around AWS SDK issues

import { S3Client } from "@aws-sdk/client-s3";
import { getCredsFromFile } from "@/util/aws/getCredsFromFile";
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
 * This function creates an S3Client with a workaround for AWS SDK bug
 * https://github.com/aws/aws-sdk-js-v3/issues/6872 by loading credentials
 * from files when a profile is specified.
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
 * @see {@link getCredsFromFile} - For credential file loading
 * @see {@link S3Client} - AWS SDK S3 client documentation
 */
export async function getS3Client(inputs: IGetS3ClientInput): Promise<S3Client> {
    const { context, profile, region } = inputs;

    // This is necessary due to this bug
    // https://github.com/aws/aws-sdk-js-v3/issues/6872
    const credentials = await getCredsFromFile({ context, profile })

    if (credentials) {
        return new S3Client({
            credentials,
            region
        });
    } else {
        return new S3Client({
            profile,
            region
        });
    }

}