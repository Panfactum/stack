// This file provides a factory function for creating AWS Account clients
// It handles credential loading from files to work around AWS SDK issues

import { AccountClient } from "@aws-sdk/client-account";
import { getCredsFromFile } from "@/util/aws/getCredsFromFile";
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
 * This function creates an AccountClient with a workaround for AWS SDK bug
 * https://github.com/aws/aws-sdk-js-v3/issues/6872 by loading credentials
 * from files when a profile is specified. The Account client is always
 * created with the us-east-1 region as Account API operations are global.
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
 * @see {@link getCredsFromFile} - For credential file loading
 * @see {@link AccountClient} - AWS SDK Account client documentation
 */
export async function getAccountClient(inputs: IGetAccountClientInput): Promise<AccountClient> {
    const { context, profile } = inputs;

    // This is necessary due to this bug
    // https://github.com/aws/aws-sdk-js-v3/issues/6872
    const credentials = await getCredsFromFile({ context, profile });

    if (credentials) {
        return new AccountClient({
            credentials,
            region: "us-east-1"
        });
    } else {
        return new AccountClient({
            profile,
            region: "us-east-1"
        });
    }

}