import { join } from "node:path"
import { parse } from "ini"
import { z } from "zod"
import { CLIError, PanfactumZodError } from "@/util/error/error"
import { fileExists } from "@/util/fs/fileExists"
import { AWS_ACCESS_KEY_ID_SCHEMA, AWS_SECRET_KEY_SCHEMA } from "./schemas"
import type { PanfactumContext } from "@/util/context/context"

type CredsPayload = {
    accessKeyId: string;
    secretAccessKey: string;
} | {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
}

export async function getCredsFromFile(inputs: { context: PanfactumContext, profile: string }): Promise<CredsPayload | undefined> {
    const { context, profile } = inputs

    const credsFilePath = join(context.repoVariables.aws_dir, "credentials")

    if (!await fileExists(credsFilePath)) {
        return undefined
    }

    // Read and parse the credentials file
    const fileContent = await Bun.file(credsFilePath).text()
        .catch((error: unknown) => {
            throw new CLIError(`Unable to read credentials file at ${credsFilePath}`, error)
        })
    
    const parsedCredentials = parse(fileContent)

    // Validate the credentials structure
    const credentialsSchema = z.object({
        [profile]: z.object({
            aws_access_key_id: AWS_ACCESS_KEY_ID_SCHEMA,
            aws_secret_access_key: AWS_SECRET_KEY_SCHEMA,
            aws_session_token: z.string().optional()
        }).optional()
    })

    const parseResult = credentialsSchema.safeParse(parsedCredentials)
    if (!parseResult.success) {
        throw new PanfactumZodError(
            `Invalid credentials format for profile '${profile}'`,
            credsFilePath,
            parseResult.error
        )
    }
    const validatedCredentials = parseResult.data

    const creds = validatedCredentials[profile]
    if (creds) {
        // This is necessary, otherwise the AWS SDK
        // will be borked by the presence of an undefined sessionToken
        if (creds.aws_session_token) {
            return {
                accessKeyId: creds.aws_access_key_id,
                secretAccessKey: creds.aws_secret_access_key,
                sessionToken: creds.aws_session_token
            }
        } else {
            return {
                accessKeyId: creds.aws_access_key_id,
                secretAccessKey: creds.aws_secret_access_key,
            }
        }
    } else {
        return undefined
    }
}