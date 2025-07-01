// This file provides utilities for retrieving the last build time from BuildKit StatefulSets
// It reads annotations to track when BuildKit was last used for builds

import { z } from 'zod'
import { CLIError } from '@/util/error/error.js'
import { execute } from '@/util/subprocess/execute.js'
import { parseJson } from '@/util/zod/parseJson.js'
import {
  type Architecture,
  BUILDKIT_NAMESPACE,
  BUILDKIT_STATEFULSET_NAME_PREFIX,
  BUILDKIT_LAST_BUILD_ANNOTATION_KEY
} from './constants.js'
import type { PanfactumContext } from '@/util/context/context.js'

/**
 * Input parameters for retrieving last build time
 */
interface IGetLastBuildTimeInput {
  /** Target architecture for the BuildKit StatefulSet */
  arch: Architecture
  /** Kubernetes context to use (optional) */
  kubectlContext?: string
  /** Panfactum context for configuration and logging */
  context: PanfactumContext
}

/**
 * Schema for Kubernetes StatefulSet structure (kubectl get statefulset -o json)
 * 
 * @remarks
 * Validates the JSON output from `kubectl get statefulset` commands.
 * Specifically designed to extract BuildKit last build time from StatefulSet
 * annotations. Uses minimal validation to focus on required metadata fields.
 * 
 * @example
 * ```typescript
 * const statefulSet = parseJson(statefulSetSchema, kubectlOutput);
 * const lastBuild = statefulSet.metadata?.annotations?.[BUILDKIT_LAST_BUILD_ANNOTATION_KEY];
 * ```
 */
const statefulSetSchema = z.object({
  metadata: z.object({
    /** Kubernetes annotations containing build metadata */
    annotations: z.record(z.string()).optional().describe('Kubernetes annotations on the StatefulSet')
  }).describe('StatefulSet metadata')
}).describe('Kubernetes StatefulSet structure for BuildKit')

/**
 * Retrieves the last build timestamp from a BuildKit StatefulSet
 * 
 * @remarks
 * This function queries BuildKit StatefulSet annotations to determine
 * when the last build occurred. This information is used for:
 * 
 * - **Auto-scaling decisions**: Scale down idle BuildKit instances
 * - **Resource optimization**: Identify underutilized build resources
 * - **Monitoring**: Track build activity across architectures
 * - **Cost management**: Clean up unused build infrastructure
 * 
 * The timestamp is stored as a Unix timestamp (milliseconds since epoch)
 * in the StatefulSet annotation `panfactum.com/last-build`.
 * 
 * The function:
 * 1. Constructs the StatefulSet name based on architecture
 * 2. Queries Kubernetes for the StatefulSet metadata
 * 3. Extracts the last build annotation
 * 4. Validates and returns the timestamp
 * 
 * @param input - Configuration for retrieving the timestamp
 * @returns Unix timestamp of last build, or null if never built
 * 
 * @example
 * ```typescript
 * // Check when amd64 BuildKit was last used
 * const lastBuild = await getLastBuildTime({
 *   context,
 *   arch: 'amd64',
 *   kubectlContext: 'production'
 * });
 * 
 * if (lastBuild) {
 *   const hoursSinceLastBuild = (Date.now() - lastBuild) / (1000 * 60 * 60);
 *   console.log(`Last build was ${hoursSinceLastBuild} hours ago`);
 * } else {
 *   console.log('No builds recorded for this architecture');
 * }
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when the StatefulSet cannot be retrieved
 * 
 * @throws {@link CLIError}
 * Throws when the timestamp annotation has invalid format
 * 
 * @throws {@link CLISubprocessError}
 * Throws when kubectl command fails
 * 
 * @see {@link recordBuild} - For updating the last build timestamp
 * @see {@link BUILDKIT_LAST_BUILD_ANNOTATION_KEY} - The annotation key used
 */
export async function getLastBuildTime(
  input: IGetLastBuildTimeInput
): Promise<number | null> {
  const { arch, kubectlContext, context } = input;
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

  const statefulSet = parseJson(statefulSetSchema, result.stdout)

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