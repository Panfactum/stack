// This file provides a factory function for creating AWS SSO Admin clients
// It uses the generic AWS client factory for consistent credential handling

import { SSOAdminClient } from "@aws-sdk/client-sso-admin";
import { createAWSClient } from "@/util/aws/clients/createAWSClient";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for creating an SSO Admin client
 */
interface IGetSSOAdminClientInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** AWS profile name to use for credentials */
  profile?: string;
  /** AWS region for the client (default: us-east-1) */
  region?: string;
}

/**
 * Creates an AWS SSO Admin client with proper credential handling
 *
 * @remarks
 * This function creates an SSOAdminClient using the generic AWS client factory
 * which handles credential loading and works around AWS SDK bug
 * https://github.com/aws/aws-sdk-js-v3/issues/6872.
 *
 * @param inputs - Configuration for the SSO Admin client
 * @returns Configured AWS SSO Admin client
 *
 * @example
 * ```typescript
 * const ssoAdminClient = await getSSOAdminClient({
 *   context,
 *   profile: 'management',
 *   region: 'us-west-2'
 * });
 *
 * const instances = await ssoAdminClient.send(new ListInstancesCommand({}));
 * ```
 *
 * @see {@link createAWSClient} - Generic AWS client factory
 * @see {@link SSOAdminClient} - AWS SDK SSO Admin client documentation
 */
export async function getSSOAdminClient(inputs: IGetSSOAdminClientInput): Promise<SSOAdminClient> {
    return createAWSClient({
        clientClass: SSOAdminClient,
        defaultRegion: "us-east-1"
    }, inputs);
}
