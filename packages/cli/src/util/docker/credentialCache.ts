import { join } from 'path'
import { z } from 'zod'
import { createDirectory } from '@/util/fs/createDirectory'
import { writeFile } from '@/util/fs/writeFile'
import { readJSONFile } from '@/util/json/readJSONFile'
import type { PanfactumContext } from '@/util/context/context'

interface CachedCredential {
  token: string
  expires: string
}

interface CredentialsFile {
  [registry: string]: CachedCredential
}

const CACHE_TTL = 4 * 60 * 60 * 1000 // 4 hours in milliseconds

async function getCredsFilePath(context: PanfactumContext): Promise<string> {
  const buildkitDir = context.repoVariables.buildkit_dir
  return join(buildkitDir, 'creds.json')
}

async function readCredsFile(context: PanfactumContext): Promise<CredentialsFile> {
  const credsFile = await getCredsFilePath(context)
  
  const credentialsFileSchema = z.record(z.object({
    token: z.string(),
    expires: z.string()
  }))
  
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
  
  // Write credentials file
  await writeFile({
    context,
    filePath: credsFile,
    contents: JSON.stringify(creds, null, 2),
    overwrite: true
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
  
  // Check if expired (expires is Unix timestamp in seconds as string)
  const expiresAt = parseInt(cached.expires, 10) * 1000 // Convert to milliseconds
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