import { execute } from '@/util/subprocess/execute.js'
import {
  type Architecture,
  BUILDKIT_NAMESPACE,
  BUILDKIT_STATEFULSET_NAME_PREFIX,
  BUILDKIT_LAST_BUILD_ANNOTATION_KEY
} from './constants.js'
import type { PanfactumContext } from '@/util/context/context.js'

interface RecordBuildOptions {
  arch: Architecture
  kubectlContext?: string
  context: PanfactumContext
}

export async function recordBuildKitBuild(
  options: RecordBuildOptions
): Promise<void> {
  const { arch, kubectlContext, context } = options
  const statefulsetName = `${BUILDKIT_STATEFULSET_NAME_PREFIX}${arch}`
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const contextArgs = kubectlContext ? ['--context', kubectlContext] : []

  await execute({
    command: [
      'kubectl',
      ...contextArgs,
      'annotate',
      'statefulset',
      statefulsetName,
      `${BUILDKIT_LAST_BUILD_ANNOTATION_KEY}=${timestamp}`,
      '--namespace',
      BUILDKIT_NAMESPACE,
      '--overwrite'
    ],
    context,
    workingDirectory: context.repoVariables.repo_root
  })
}