import {
  type Architecture,
  BUILDKIT_NAMESPACE,
  BUILDKIT_STATEFULSET_NAME_PREFIX,
  BUILDKIT_LAST_BUILD_ANNOTATION_KEY
} from './constants.js'
import { execute } from '../subprocess/execute.js'
import type { PanfactumContext } from '@/util/context/context.js'

interface GetLastBuildTimeOptions {
  arch: Architecture
  kubectlContext?: string
  context: PanfactumContext
}

export async function getLastBuildTime(
  options: GetLastBuildTimeOptions
): Promise<number | null> {
  const { arch, kubectlContext, context } = options
  const statefulsetName = `${BUILDKIT_STATEFULSET_NAME_PREFIX}${arch}`
  const contextArgs = kubectlContext ? ['--context', kubectlContext] : []

  try {
    const result = await execute({
      command: [
        'kubectl',
        ...contextArgs,
        'get',
        'statefulset',
        statefulsetName,
        '--namespace',
        BUILDKIT_NAMESPACE,
        `-o=go-template={{index .metadata.annotations "${BUILDKIT_LAST_BUILD_ANNOTATION_KEY}"}}`
      ],
      context,
      workingDirectory: process.cwd()
    })

    const lastBuild = result.stdout.trim()
    if (!lastBuild || lastBuild === '<no value>') {
      return null
    }

    const timestamp = parseInt(lastBuild, 10)
    return isNaN(timestamp) ? null : timestamp
  } catch {
    return null
  }
}