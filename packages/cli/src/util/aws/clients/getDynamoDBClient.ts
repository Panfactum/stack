// This file provides a factory function for creating AWS DynamoDB clients
// It handles credential loading from files to work around AWS SDK issues

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { getCredsFromFile } from "@/util/aws/getCredsFromFile";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for creating a DynamoDB client
 */
interface IGetDynamoDBClientInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** AWS profile name to use for credentials */
  profile?: string;
  /** AWS region for the client (default: us-east-1) */
  region?: string;
}

/**
 * Creates an AWS DynamoDB client with proper credential handling
 * 
 * @remarks
 * This function creates a DynamoDBClient with a workaround for AWS SDK bug
 * https://github.com/aws/aws-sdk-js-v3/issues/6872 by loading credentials
 * from files when a profile is specified.
 * 
 * @param inputs - Configuration for the DynamoDB client
 * @returns Configured AWS DynamoDB client
 * 
 * @example
 * ```typescript
 * const dynamoClient = await getDynamoDBClient({
 *   context,
 *   profile: 'production',
 *   region: 'us-west-2'
 * });
 * 
 * const tables = await dynamoClient.send(new ListTablesCommand({}));
 * ```
 * 
 * @see {@link getCredsFromFile} - For credential file loading
 * @see {@link DynamoDBClient} - AWS SDK DynamoDB client documentation
 */
export async function getDynamoDBClient(inputs: IGetDynamoDBClientInput): Promise<DynamoDBClient> {
  const { context, profile, region = "us-east-1" } = inputs;

  // This is necessary due to this bug
  // https://github.com/aws/aws-sdk-js-v3/issues/6872
  const credentials = profile ? await getCredsFromFile({ context, profile }) : undefined;

  if (credentials) {
    return new DynamoDBClient({
      credentials,
      region
    });
  } else {
    return new DynamoDBClient({
      profile,
      region
    });
  }
}