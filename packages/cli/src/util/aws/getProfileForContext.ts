// Utility function to get AWS profile for a Kubernetes context
// Extracted from the aws profile-for-context command

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import type { PanfactumContext } from '@/util/context/context'
import { CLIError } from '@/util/error/error'

export function getAWSProfileForContext(
  context: PanfactumContext,
  kubeContext: string
): string {
  const { repoVariables } = context
  const kubeDir = repoVariables.kube_dir
  const kubeUserConfigFile = join(kubeDir, 'config.user.yaml')

  // Check if config file exists
  if (!existsSync(kubeUserConfigFile)) {
    throw new CLIError(
      `Error: ${kubeUserConfigFile} does not exist. It is required to set this up before interacting with BuildKit.`
    )
  }

  // Check if context exists in kubeconfig
  try {
    execSync(`kubectl config get-contexts "${kubeContext}"`, {
      stdio: 'pipe',
      encoding: 'utf8'
    })
  } catch {
    throw new CLIError(
      `'${kubeContext}' not found in kubeconfig. Run pf-update-kube to regenerate kubeconfig.`
    )
  }

  // Get AWS profile from config
  const awsProfile = execSync(
    `yq -r '.clusters[] | select(.name == "${kubeContext}") | .aws_profile' "${kubeUserConfigFile}"`,
    { encoding: 'utf8', stdio: 'pipe' }
  ).trim()

  if (!awsProfile || awsProfile === 'null') {
    throw new CLIError(
      `Error: AWS profile not configured for cluster ${kubeContext}. Add cluster to ${kubeUserConfigFile}.`
    )
  }

  return awsProfile
}