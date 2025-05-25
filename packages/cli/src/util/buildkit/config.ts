import { readFileSync } from 'fs'
import { join } from 'path'
import { z } from 'zod'
import type { BuildKitConfig } from './constants.js'
import type { PanfactumContext } from '@/util/context/context.js'

const buildKitConfigSchema = z.object({
  registry: z.string(),
  cache_bucket: z.string(),
  cache_bucket_region: z.string(),
  cluster: z.string(),
  bastion: z.string()
})

export async function getBuildKitConfig(context: PanfactumContext): Promise<BuildKitConfig> {
  const repoVars = context.repoVariables
  const buildkitDir = repoVars.buildkit_dir
  const configPath = join(buildkitDir, 'buildkit.json')

  let config: unknown
  try {
    const configContent = readFileSync(configPath, 'utf-8')
    config = JSON.parse(configContent)
  } catch {
    throw new Error(
      `No BuildKit configuration file exists at ${configPath}. A superuser must create one by running 'pf-update-buildkit --build'.`
    )
  }

  const parseResult = buildKitConfigSchema.safeParse(config)
  if (!parseResult.success) {
    throw new Error(
      `Invalid BuildKit configuration: ${parseResult.error.message}`
    )
  }

  return parseResult.data
}