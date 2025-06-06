// Utility function to get AWS profile for a Kubernetes context
// Extracted from the aws profile-for-context command

import { existsSync } from 'fs'
import { join } from 'path'
import { z } from 'zod'
import { CLUSTERS_FILE_SCHEMA } from '@/util/devshell/updateKubeConfig'
import { CLIError } from '@/util/error/error'
import { readYAMLFile } from '@/util/yaml/readYAMLFile'
import type { PanfactumContext } from '@/util/context/context'

const USER_CONFIG_SCHEMA = z.object({
  clusters: z.array(z.object({
    name: z.string(),
    aws_profile: z.string()
  }))
})

export async function getAWSProfileForContext(
  context: PanfactumContext,
  kubeContext: string
): Promise<string> {
  const { repoVariables } = context
  const kubeDir = repoVariables.kube_dir
  const kubeUserConfigFile = join(kubeDir, 'config.user.yaml')

  // Check if config file exists
  if (!existsSync(kubeUserConfigFile)) {
    throw new CLIError(
      `Error: ${kubeUserConfigFile} does not exist. It is required to set this up before interacting with BuildKit.`
    )
  }

  // Check if context exists in clusters.yaml
  const clustersData = await readYAMLFile({
    context,
    filePath: `${kubeDir}/clusters.yaml`,
    validationSchema: CLUSTERS_FILE_SCHEMA,
    throwOnMissing: false,
    throwOnEmpty: false
  })

  if (!clustersData || !clustersData[kubeContext]) {
    throw new CLIError(
      `'${kubeContext}' not found in clusters.yaml. Run pf devshell sync to regenerate kubeconfig.`
    )
  }

  // Get AWS profile from config.user.yaml
  const userConfigData = await readYAMLFile({
    context,
    filePath: kubeUserConfigFile,
    validationSchema: USER_CONFIG_SCHEMA,
    throwOnMissing: true,
    throwOnEmpty: true
  })

  if (!userConfigData) {
    throw new CLIError(
      `Error: Unable to read ${kubeUserConfigFile}.`
    )
  }

  const cluster = userConfigData.clusters.find(c => c.name === kubeContext)
  
  if (!cluster || !cluster.aws_profile) {
    throw new CLIError(
      `Error: AWS profile not configured for cluster ${kubeContext}. Add cluster to ${kubeUserConfigFile}.`
    )
  }

  return cluster.aws_profile
}