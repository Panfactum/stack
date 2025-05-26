import { promises as fs } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

interface CachedCredential {
  token: string
  username: string
  expiresAt: number
}

const CACHE_DIR = join(homedir(), '.docker', 'panfactum-cache')
const CACHE_TTL = 4 * 60 * 60 * 1000 // 4 hours in milliseconds

export async function getCachedCredential(registry: string): Promise<CachedCredential | null> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true })
    
    const cacheFile = join(CACHE_DIR, `${registry.replace(/[^a-zA-Z0-9]/g, '_')}.json`)
    const data = await fs.readFile(cacheFile, 'utf8')
    const cached = JSON.parse(data) as CachedCredential
    
    if (Date.now() < cached.expiresAt) {
      return cached
    }
    
    // Clean up expired cache
    await fs.unlink(cacheFile).catch(() => {
      // Ignore errors
    })
  } catch {
    // No cache or invalid cache
  }
  
  return null
}

export async function setCachedCredential(
  registry: string,
  token: string,
  username: string
): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true })
  
  const cacheFile = join(CACHE_DIR, `${registry.replace(/[^a-zA-Z0-9]/g, '_')}.json`)
  const credential: CachedCredential = {
    token,
    username,
    expiresAt: Date.now() + CACHE_TTL,
  }
  
  await fs.writeFile(cacheFile, JSON.stringify(credential), 'utf8')
}