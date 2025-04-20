import type { PanfactumContext } from "@/context/context"
import { input } from "@inquirer/prompts"
import { fileExists } from "../fs/fileExists"
import {join} from "node:path"
import {parse} from "ini"
import { z, ZodError } from "zod"
import { AWS_ACCESS_KEY_ID_SCHEMA, AWS_SECRET_KEY_SCHEMA } from "./schemas"
import { CLIError, PanfactumZodError } from "../error/error"

type CredsPayload =  {
    accessKeyId: string;
    secretAccessKey: string;
} | {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
}

export async function getCredsFromFile(inputs: {context: PanfactumContext, profile: string}): Promise<CredsPayload | undefined>{
    const {context, profile} = inputs 

    const credsFilePath = join(context.repoVariables.aws_dir, "credentials")

    if(!await fileExists(credsFilePath)){
        return undefined
    }
    try {
        const credsFileContents = z.object({
            [profile]: z.object({
                aws_access_key_id: AWS_ACCESS_KEY_ID_SCHEMA,
                aws_secret_access_key: AWS_SECRET_KEY_SCHEMA,
                aws_session_token: z.string().optional()
            }).optional()
        }).parse(parse(await Bun.file(credsFilePath).text()))

        const creds = credsFileContents[profile]
        if(creds){
            // This is necessary, otherwise the AWS SDK
            // will be borked by the presence of an undefined sessionToken
            if(creds.aws_session_token){
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
    } catch(e){
        if(e instanceof ZodError){
            throw new PanfactumZodError(`Invalid credentials format for profile '${profile}'`, credsFilePath, e)
        } else {
            throw new CLIError(`Unable to read credentails for '${profile}'`, e)
        }
    }
}