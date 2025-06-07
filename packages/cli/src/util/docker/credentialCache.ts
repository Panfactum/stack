import { promises as fs } from 'fs'
import { join } from 'path'
import { z } from 'zod'
import { parseJson } from '@/util/zod/parseJson'
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
  try {
    const credsFile = await getCredsFilePath(context)
    const data = await fs.readFile(credsFile, 'utf8')
    
    const credentialsFileSchema = z.record(z.object({
      token: z.string(),
      expires: z.string()
    }))
    
    return parseJson(credentialsFileSchema, data)
  } catch {
    return {}
  }
}

async function writeCredsFile(context: PanfactumContext, creds: CredentialsFile): Promise<void> {
  const credsFile = await getCredsFilePath(context)
  const buildkitDir = context.repoVariables.buildkit_dir
  
  // Ensure buildkit directory exists
  await fs.mkdir(buildkitDir, { recursive: true })
  
  // Write atomically using a temp file
  const tmpFile = join(buildkitDir, 'tmp.json')
  await fs.writeFile(tmpFile, JSON.stringify(creds, null, 2), 'utf8')
  await fs.rename(tmpFile, credsFile)
}

export async function getCachedCredential(
  context: PanfactumContext,
  registry: string
): Promise<{ token: string; username: string } | null> {
  const creds = await readCredsFile(context)
  const cached = creds[registry]
  
  if (!cached) {
    return null
  }
  
  // Check if expired (expires is Unix timestamp in seconds as string)
  const expiresAt = parseInt(cached.expires, 10) * 1000 // Convert to milliseconds
  if (Date.now() < expiresAt) {
    return {
      token: cached.token,
      username: 'AWS' // ECR always uses AWS as username
    }
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