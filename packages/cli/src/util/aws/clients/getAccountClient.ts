// This file provides a factory function for creating AWS Account clients
// It uses the generic createAWSClient factory to reduce code duplication

import { AccountClient } from "@aws-sdk/client-account";
import { createAWSClient } from "./createAWSClient";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for creating an Account client
 */
interface IGetAccountClientInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** AWS profile name to use for credentials */
  profile: string;
}

/**
 * Creates an AWS Account client with proper credential handling
 * 
 * @remarks
 * This function creates an AccountClient using the centralized createAWSClient factory,
 * which handles the AWS SDK bug workaround and credential loading consistently
 * across all AWS service clients. The Account client is always created with the
 * us-east-1 region as Account API operations are global.
 * 
 * @param inputs - Configuration for the Account client
 * @returns Configured AWS Account client
 * 
 * @example
 * ```typescript
 * const accountClient = await getAccountClient({
 *   context,
 *   profile: 'production'
 * });
 * 
 * const contactInfo = await accountClient.send(
 *   new GetContactInformationCommand({})
 * );
 * ```
 * 
 * @see {@link createAWSClient} - Generic AWS client factory
 * @see {@link AccountClient} - AWS SDK Account client documentation
 */
export async function getAccountClient(inputs: IGetAccountClientInput): Promise<AccountClient> {
  return createAWSClient(
    {
      clientClass: AccountClient,
      defaultRegion: "us-east-1"
    },
    {
      context: inputs.context,
      profile: inputs.profile,
      region: "us-east-1" // Account operations are global, always use us-east-1
    }
  );
}