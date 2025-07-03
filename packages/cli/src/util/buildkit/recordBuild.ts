// This file provides utilities for recording build timestamps on BuildKit StatefulSets
// It updates annotations to track when BuildKit was last used for builds

import { execute } from '@/util/subprocess/execute.js'
import {
  type Architecture,
  BUILDKIT_NAMESPACE,
  BUILDKIT_STATEFULSET_NAME_PREFIX,
  BUILDKIT_LAST_BUILD_ANNOTATION_KEY
} from './constants.js'
import type { PanfactumContext } from '@/util/context/context.js'

/**
 * Input parameters for recording a BuildKit build
 */
interface IRecordBuildKitBuildInput {
  /** Target architecture for the BuildKit StatefulSet */
  arch: Architecture
  /** Kubernetes context to use (optional) */
  kubectlContext?: string
  /** Panfactum context for configuration and logging */
  context: PanfactumContext
}

/**
 * Records the current timestamp on a BuildKit StatefulSet to track build activity
 * 
 * @remarks
 * This function updates the BuildKit StatefulSet annotation with the current
 * timestamp whenever a build is initiated. This tracking mechanism enables:
 * 
 * - **Resource Management**: Identify active vs idle BuildKit instances
 * - **Auto-scaling**: Make informed decisions about scaling down unused pods
 * - **Cost Optimization**: Remove idle build infrastructure
 * - **Activity Monitoring**: Track build patterns across architectures
 * 
 * The timestamp is stored as a Unix timestamp (seconds since epoch) in the
 * StatefulSet annotation `panfactum.com/last-build`. This annotation is
 * overwritten with each new build.
 * 
 * The function:
 * 1. Constructs the StatefulSet name based on architecture
 * 2. Generates current Unix timestamp
 * 3. Updates the StatefulSet annotation via kubectl
 * 
 * This should be called at the start of each build operation to ensure
 * accurate tracking of BuildKit utilization.
 * 
 * @param input - Configuration for recording the build
 * 
 * @example
 * ```typescript
 * // Record a build on amd64 architecture
 * await recordBuildKitBuild({
 *   context,
 *   arch: 'amd64',
 *   kubectlContext: 'production'
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Record build before starting Docker build
 * await recordBuildKitBuild({ context, arch: 'arm64' });
 * await dockerBuild({ 
 *   context,
 *   dockerfile: './Dockerfile',
 *   arch: 'arm64'
 * });
 * ```
 * 
 * @throws {@link CLISubprocessError}
 * Throws when kubectl annotate command fails
 * 
 * @see {@link getLastBuildTime} - For retrieving the recorded timestamp
 * @see {@link BUILDKIT_LAST_BUILD_ANNOTATION_KEY} - The annotation key used
 * @see {@link execute} - For kubectl command execution
 */
export async function recordBuildKitBuild(
  input: IRecordBuildKitBuildInput
): Promise<void> {
  const { arch, kubectlContext, context } = input;
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
    workingDirectory: context.devshellConfig.repo_root
  })
}