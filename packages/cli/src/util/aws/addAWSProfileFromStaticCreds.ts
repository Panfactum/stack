import { join } from "node:path"
import { stringify, parse } from 'ini'
import { CLIError } from "@/util/error/error";
import { fileExists } from "@/util/fs/fileExists";
import { writeFile } from "@/util/fs/writeFile";
import type { PanfactumContext } from "@/context/context";

export async function addAWSProfileFromStaticCreds(inputs: { context: PanfactumContext, creds: { secretAccessKey: string, accessKeyId: string }, profile: string }) {
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

    if (await fileExists(configFilePath)) {
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
        config = configUpdate
        credentials = credentialUpdate
    }

    try {
        await writeFile({ context, path: configFilePath, contents: stringify(config, { newline: false, whitespace: true }), overwrite: true })
    } catch (e) {
        throw new CLIError(`Failed to write new AWS config file at ${configFilePath}`, e)
    }

    try {
        await writeFile({ context, path: credentialsFilePath, contents: stringify(credentials, { newline: false, whitespace: true }), overwrite: true })
    } catch (e) {
        throw new CLIError(`Failed to write AWS credentials file to ${credentialsFilePath}`, e)
    }

}