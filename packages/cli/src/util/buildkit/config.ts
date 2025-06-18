import { join } from 'path'
import { z, ZodError } from 'zod'
import { CLIError, PanfactumZodError } from '@/util/error/error'
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
  }).catch((error: unknown) => {
    if (error instanceof ZodError) {
      throw new PanfactumZodError('Invalid BuildKit configuration', configPath, error)
    }
    throw new CLIError(
      `Failed to get BuildKit Config from ${configPath}`,
      error
    )
  })

  if (!config) {
    throw new CLIError(
      `No BuildKit configuration file exists at ${configPath}. A superuser must create one by running 'pf devshell sync'.`
    )
  }

  return config
}