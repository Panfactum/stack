// This file provides utilities for retrieving AWS identity information
// It includes automatic SSO login handling for expired credentials

import { GetCallerIdentityCommand, type GetCallerIdentityCommandOutput } from "@aws-sdk/client-sts";
import { CLIError } from "@/util/error/error";
import { execute } from "@/util/subprocess/execute";
import { getSTSClient } from "./clients/getSTSClient";
import { getCredsFromFile } from "./getCredsFromFile";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for getting AWS identity
 */
interface IGetIdentityInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** AWS profile name to use */
  profile: string;
}

/**
 * Fetches the AWS identity for a given profile with automatic SSO handling
 * 
 * @remarks
 * This function retrieves AWS caller identity information using STS.
 * If SSO credentials are expired, it will automatically attempt to:
 * 1. Log out of the expired SSO session
 * 2. Log back in to SSO
 * 3. Retry the identity request
 * 
 * The function includes retry logic with 5-second delays to handle
 * eventual consistency when new IAM users are created.
 * 
 * @param input - Configuration including context and profile name
 * @returns AWS identity information from STS GetCallerIdentity
 * 
 * @example
 * ```typescript
 * const identity = await getIdentity({
 *   context,
 *   profile: 'production'
 * });
 * console.log(`Account: ${identity.Account}`);
 * console.log(`User ARN: ${identity.Arn}`);
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when unable to retrieve identity after retries and SSO attempts
 * 
 * @see {@link getSTSClient} - For STS client creation
 * @see {@link getCredsFromFile} - For credential file loading
 */
export async function getIdentity(input: IGetIdentityInput): Promise<GetCallerIdentityCommandOutput> {
    const { context, profile } = input;

    const stsClient = await getSTSClient({ context, profile });
    
    // Track if we already have credentials (for SSO fix logic)
    const credentials = await getCredsFromFile({ context, profile });
    let attemptedSSOFix = Boolean(credentials);
    let retries = 0

    while (retries < 5) {
        try {
            context.logger.debug(`sts get-caller-identity`, { profile })
            return await stsClient.send(new GetCallerIdentityCommand({}));
        } catch (e: unknown) {
            if (!attemptedSSOFix) {
                const errorMessage = e instanceof Error ? e.message : String(e);
                if (errorMessage.includes(`sso`) || errorMessage.includes(`SSO`)) {
                    if (errorMessage.includes("expired") ||
                        errorMessage.includes("refresh failed")) {
                        await execute({
                            context,
                            workingDirectory: process.cwd(),
                            command: ["aws", "sso", "logout", "--profile", profile]
                        })

                    }
                    await execute({
                        context,
                        workingDirectory: process.cwd(),
                        command: ["aws", "sso", "login", "--profile", profile]
                    })
                    attemptedSSOFix = true
                    continue
                }
            }

            if (retries < 5) {
                // If we are calling this immediately after creating a new user,
                // it can take some time to update
                await new Promise((resolve) => {
                    globalThis.setTimeout(resolve, 5000);
                });
                retries++
                continue
            }


            // If it's not an SSO issue or re-login failed, throw the original error
            throw new CLIError(`Failed to get identity for profile '${profile}'`, e)
        }
    }
    throw new CLIError(`Failed to get identity for profile '${profile}'`)
}
