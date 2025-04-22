import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import { getCredsFromFile } from "./getCredsFromFile";
import { CLIError } from "../error/error";
import { execute } from "../subprocess/execute";
import type { PanfactumContext } from "@/context/context";

/**
 * Fetches the AWS identity for a given profile.
 * If SSO sign-in is needed, will attempt to handle the sign-in process automatically.
 * 
 * @param input - Object containing context and profile name
 * @returns The AWS identity information from STS
 */
export async function getIdentity(input: { context: PanfactumContext, profile: string }) {
    const { context, profile } = input;

    // This is necessary due to this bug
    // https://github.com/aws/aws-sdk-js-v3/issues/6872
    const credentials = await getCredsFromFile({ context, profile })

    let stsClient;
    if (credentials) {
        stsClient = new STSClient({
            credentials,
            region: "us-east-1"
        });
    } else {
        stsClient = new STSClient({
            profile,
            region: "us-east-1"
        });
    }

    let attemptedSSOFix = Boolean(credentials);
    let retries = 0
    while (retries < 5) {
        try {
            context.logger.log(`Calling 'sts get-caller-identity' on profile ${profile}`, { level: "debug" })
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
    throw new CLIError(`Failed to get identity for profile '${profile}'`, e)
}
