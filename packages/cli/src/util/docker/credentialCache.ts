import { join } from 'path'
import { z } from 'zod'
import { CLIError } from '@/util/error/error'
import { createDirectory } from '@/util/fs/createDirectory'
import { writeFile } from '@/util/fs/writeFile'
import { readJSONFile } from '@/util/json/readJSONFile'
import type { PanfactumContext } from '@/util/context/context'

const cachedCredentialSchema = z.object({
  token: z.string(),
  expires: z.string()
})

const credentialsFileSchema = z.record(cachedCredentialSchema)

type CredentialsFile = z.infer<typeof credentialsFileSchema>

const CACHE_TTL = 4 * 60 * 60 * 1000 // 4 hours in milliseconds

async function getCredsFilePath(context: PanfactumContext): Promise<string> {
  const buildkitDir = context.repoVariables.buildkit_dir
  return join(buildkitDir, 'creds.json')
}

async function readCredsFile(context: PanfactumContext): Promise<CredentialsFile> {
  const credsFile = await getCredsFilePath(context)
  
  const result = await readJSONFile({
    context,
    filePath: credsFile,
    validationSchema: credentialsFileSchema,
    throwOnMissing: false,
    throwOnEmpty: false
  })
  
  return result || {}
}

async function writeCredsFile(context: PanfactumContext, creds: CredentialsFile): Promise<void> {
  const credsFile = await getCredsFilePath(context)
  const buildkitDir = context.repoVariables.buildkit_dir
  
  // Ensure buildkit directory exists
  await createDirectory(buildkitDir)
    .catch((error: unknown) => {
      throw new CLIError(
        `Failed to create directory ${buildkitDir}`,
        error
      )
    })
  
  // Write credentials file
  await writeFile({
    context,
    filePath: credsFile,
    contents: JSON.stringify(creds, null, 2),
    overwrite: true
  }).catch((error: unknown) => {
    throw new CLIError(
      `Failed to write Docker credentials cache to ${credsFile}`,
      error
    )
  })
}

export async function getCachedCredential(
  context: PanfactumContext,
  registry: string
): Promise<string | null> {
  const creds = await readCredsFile(context)
  
  const cached = creds[registry]
  
  if (!cached) {
    return null
  }
  
  // Validate expires field is a valid number
  const timestamp = parseInt(cached.expires, 10)
  if (isNaN(timestamp)) {
    throw new CLIError(
      `Invalid expiration timestamp for registry '${registry}': ${cached.expires}`
    )
  }
  const expiresAt = timestamp * 1000 // Convert to milliseconds
  
  if (Date.now() < expiresAt) {
    return cached.token // Return the full base64 authorization token
  }
  
  // Clean up expired credential
  delete creds[registry]
  await writeCredsFile(context, creds)
  
  return null
}

export async function setCachedCredential(
  context: PanfactumContext,
  registry: string,
  token: string,
): Promise<void> {
  const creds = await readCredsFile(context)
  
  // Calculate expiration as Unix timestamp in seconds (4 hours from now)
  const expiresAt = Math.floor((Date.now() + CACHE_TTL) / 1000)
  
  creds[registry] = {
    token,
    expires: expiresAt.toString()
  }
  
  await writeCredsFile(context, creds)
}