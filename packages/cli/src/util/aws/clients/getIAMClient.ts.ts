// This file provides a factory function for creating AWS IAM clients
// It handles credential loading from files to work around AWS SDK issues

import { IAMClient } from "@aws-sdk/client-iam";
import { getCredsFromFile } from "@/util/aws/getCredsFromFile";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for creating an IAM client
 */
interface IGetIAMClientInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** AWS profile name to use for credentials */
  profile: string;
  /** AWS region for the client (default: us-east-1) */
  region?: string;
}

/**
 * Creates an AWS IAM client with proper credential handling
 * 
 * @remarks
 * This function creates an IAMClient with a workaround for AWS SDK bug
 * https://github.com/aws/aws-sdk-js-v3/issues/6872 by loading credentials
 * from files when a profile is specified.
 * 
 * Note: IAM is a global service, so the region is always set to us-east-1
 * 
 * @param inputs - Configuration for the IAM client
 * @returns Configured AWS IAM client
 * 
 * @example
 * ```typescript
 * const iamClient = await getIAMClient({
 *   context,
 *   profile: 'production'
 * });
 * 
 * const users = await iamClient.send(new ListUsersCommand({}));
 * ```
 * 
 * @see {@link getCredsFromFile} - For credential file loading
 * @see {@link IAMClient} - AWS SDK IAM client documentation
 */
export async function getIAMClient(inputs: IGetIAMClientInput): Promise<IAMClient> {
    const { context, profile, region = "us-east-1" } = inputs;

    // This is necessary due to this bug
    // https://github.com/aws/aws-sdk-js-v3/issues/6872
    const credentials = await getCredsFromFile({ context, profile })

    if (credentials) {
        return new IAMClient({
            credentials,
            region
        });
    } else {
        return new IAMClient({
            profile,
            region
        });
    }

}