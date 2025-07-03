// This file provides a factory function for creating AWS DynamoDB clients
// It uses the generic createAWSClient factory to reduce code duplication

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { createAWSClient } from "./createAWSClient";
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
 * This function creates a DynamoDBClient using the centralized createAWSClient factory,
 * which handles the AWS SDK bug workaround and credential loading consistently
 * across all AWS service clients.
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
 * @see {@link createAWSClient} - Generic AWS client factory
 * @see {@link DynamoDBClient} - AWS SDK DynamoDB client documentation
 */
export async function getDynamoDBClient(inputs: IGetDynamoDBClientInput): Promise<DynamoDBClient> {
  return createAWSClient(
    {
      clientClass: DynamoDBClient,
      defaultRegion: "us-east-1"
    },
    inputs
  );
}