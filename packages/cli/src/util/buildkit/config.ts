import { join } from 'path'
import { z } from 'zod'
import { readJSONFile } from '@/util/json/readJSONFile'
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

  const config = await readJSONFile({
    context,
    filePath: configPath,
    validationSchema: buildKitConfigSchema,
    throwOnMissing: true,
    throwOnEmpty: true
  })

  // This should never happen with throwOnMissing and throwOnEmpty set to true
  if (!config) {
    throw new Error('Unexpected null config from readJSONFile')
  }

  return config
}