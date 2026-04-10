// This file provides a factory function for creating AWS SES v2 clients
// It uses the generic AWS client factory for consistent credential handling

import { SESv2Client } from "@aws-sdk/client-sesv2";
import { createAWSClient } from "@/util/aws/clients/createAWSClient";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for creating an SES v2 client
 */
interface IGetSESv2ClientInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** AWS profile name to use for credentials */
  profile: string;
  /** AWS region for the client */
  region: string;
}

/**
 * Creates an AWS SES v2 client with proper credential handling
 *
 * @remarks
 * This function creates an SESv2Client using the generic AWS client factory
 * which handles credential loading and works around AWS SDK bug
 * https://github.com/aws/aws-sdk-js-v3/issues/6872.
 *
 * SES is a regional service — the region determines which SES endpoint
 * is used and which sandbox/production status is checked or updated.
 *
 * @param inputs - Configuration for the SES v2 client
 * @returns Configured AWS SES v2 client
 *
 * @example
 * ```typescript
 * const sesClient = await getSESv2Client({
 *   context,
 *   profile: 'production',
 *   region: 'us-east-1'
 * });
 *
 * const account = await sesClient.send(new GetAccountCommand({}));
 * ```
 *
 * @see {@link createAWSClient} - Generic AWS client factory
 * @see {@link SESv2Client} - AWS SDK SES v2 client documentation
 */
export async function getSESv2Client(inputs: IGetSESv2ClientInput): Promise<SESv2Client> {
    return createAWSClient({
        clientClass: SESv2Client,
    }, inputs);
}
