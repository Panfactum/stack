// This file provides utilities for adding AWS profiles with static credentials
// It manages AWS config and credentials files in INI format

import { join } from "node:path"
import { stringify, parse } from 'ini'
import { CLIError } from "@/util/error/error";
import { fileExists } from "@/util/fs/fileExists";
import { writeFile } from "@/util/fs/writeFile";
import type { PanfactumContext } from "@/util/context/context";

/**
 * AWS static credentials
 */
interface IAWSStaticCredentials {
  /** AWS secret access key */
  secretAccessKey: string;
  /** AWS access key ID */
  accessKeyId: string;
}

/**
 * Input parameters for adding an AWS profile with static credentials
 */
interface IAddAWSProfileFromStaticCredsInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** AWS credentials to store */
  creds: IAWSStaticCredentials;
  /** Profile name to create or update */
  profile: string;
}

/**
 * Adds or updates an AWS profile with static credentials
 * 
 * @remarks
 * This function manages both the AWS config and credentials files,
 * creating them if they don't exist or updating existing profiles.
 * The config file is updated with default output format and region,
 * while the credentials file stores the access keys.
 * 
 * @param inputs - Configuration including context, credentials, and profile name
 * 
 * @example
 * ```typescript
 * await addAWSProfileFromStaticCreds({
 *   context,
 *   creds: {
 *     accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
 *     secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
 *   },
 *   profile: 'dev-environment'
 * });
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when unable to read existing AWS config files
 * 
 * @throws {@link CLIError}
 * Throws when unable to write AWS config or credentials files
 * 
 * @see {@link fileExists} - For checking file existence
 * @see {@link writeFile} - For writing INI files
 */
export async function addAWSProfileFromStaticCreds(inputs: IAddAWSProfileFromStaticCredsInput): Promise<void> {
    const {
        context,
        creds: {
            secretAccessKey,
            accessKeyId
        },
        profile
    } = inputs;

    const configFilePath = join(context.repoVariables.aws_dir, "config")
    const credentialsFilePath = join(context.repoVariables.aws_dir, "credentials")

    let config, credentials;


    const configUpdate = {
        [`profile ${profile}`]: {
            output: "text",
            region: "us-east-1" // Make this the default region as it has access to the most resources
        }
    }
    const credentialUpdate = {
        [profile]: {
            "aws_access_key_id": accessKeyId,
            "aws_secret_access_key": secretAccessKey
        }
    }

    if (await fileExists({ filePath: configFilePath })) {
        try {
            const awsConfigFile = Bun.file(configFilePath);
            const originalAWSConfig = parse(await awsConfigFile.text());
            config = {
                ...originalAWSConfig,
                ...configUpdate
            }

        } catch (e) {
            throw new CLIError(`Failed to read existing AWS config at ${configFilePath}`, e)
        }
    } else {
        config = configUpdate
    }

    if (await fileExists({ filePath: credentialsFilePath })) {
        try {
            const awsCredentialsFile = Bun.file(credentialsFilePath);
            const originalAWSCredentials = parse(await awsCredentialsFile.text());
            credentials = {
                ...originalAWSCredentials,
                ...credentialUpdate
            }
        } catch (e) {
            throw new CLIError(`Failed to read existing AWS credentials at ${credentialsFilePath}`, e)
        }
    } else {
        credentials = credentialUpdate
    }

    try {
        await writeFile({ context, filePath: configFilePath, contents: stringify(config, { newline: false, whitespace: true }), overwrite: true })
    } catch (e) {
        throw new CLIError(`Failed to write new AWS config file at ${configFilePath}`, e)
    }

    try {
        await writeFile({ context, filePath: credentialsFilePath, contents: stringify(credentials, { newline: false, whitespace: true }), overwrite: true })
    } catch (e) {
        throw new CLIError(`Failed to write AWS credentials file to ${credentialsFilePath}`, e)
    }

}