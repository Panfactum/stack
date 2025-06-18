import { z, ZodError } from 'zod'
import { CLIError, PanfactumZodError } from '@/util/error/error.js'
import { execute } from '@/util/subprocess/execute.js'
import { parseJson } from '@/util/zod/parseJson.js'
import {
  type Architecture,
  BUILDKIT_NAMESPACE,
  BUILDKIT_STATEFULSET_NAME_PREFIX,
  BUILDKIT_LAST_BUILD_ANNOTATION_KEY
} from './constants.js'
import type { PanfactumContext } from '@/util/context/context.js'

interface GetLastBuildTimeOptions {
  arch: Architecture
  kubectlContext?: string
  context: PanfactumContext
}

const statefulSetSchema = z.object({
  metadata: z.object({
    annotations: z.record(z.string()).optional()
  })
})

export async function getLastBuildTime(
  options: GetLastBuildTimeOptions
): Promise<number | null> {
  const { arch, kubectlContext, context } = options
  const statefulsetName = `${BUILDKIT_STATEFULSET_NAME_PREFIX}${arch}`
  const contextArgs = kubectlContext ? ['--context', kubectlContext] : []

  const result = await execute({
    command: [
      'kubectl',
      ...contextArgs,
      'get',
      'statefulset',
      statefulsetName,
      '--namespace',
      BUILDKIT_NAMESPACE,
      '-o=json'
    ],
    context,
    workingDirectory: context.repoVariables.repo_root
  }).catch((error: unknown) => {
    throw new CLIError(
      `Failed to get statefulset ${statefulsetName} for BuildKit ${arch}`,
      error
    )
  })

  const statefulSet = await Promise.resolve(result.stdout)
    .then(output => parseJson(statefulSetSchema, output))
    .catch((error: unknown) => {
      if (error instanceof ZodError) {
        throw new PanfactumZodError(
          `Invalid statefulset format for ${statefulsetName}`,
          'kubectl output',
          error
        )
      }
      throw new CLIError(
        `Failed to parse statefulset output for ${statefulsetName}`,
        error
      )
    })

  const lastBuild = statefulSet.metadata.annotations?.[BUILDKIT_LAST_BUILD_ANNOTATION_KEY]
  
  if (!lastBuild) {
    return null
  }

  const timestamp = parseInt(lastBuild, 10)
  if (isNaN(timestamp)) {
    throw new CLIError(`Invalid timestamp format in BuildKit annotation: ${lastBuild}`)
  }
  
  return timestamp
}