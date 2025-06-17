// Utility function to get AWS profile for a Kubernetes context
// Extracted from the kube profile-for-context command
import { CLIError } from '@/util/error/error'
import { getAllRegions } from "@/util/config/getAllRegions.ts";

import type { PanfactumContext } from '@/util/context/context'

export async function getAWSProfileForContext(
  context: PanfactumContext,
  kubeContext: string
): Promise<string> {
  const regions = await getAllRegions(context)
  const selectedRegion = regions.find(region => region.clusterContextName === kubeContext)

  if (!selectedRegion) {
    throw new CLIError(`No region found for context '${kubeContext}'. Available contexts: ${regions.map(r => r.clusterContextName).join(', ')}`);
  }

  if (!selectedRegion.awsProfile) {
    throw new CLIError(`No AWS profile associated with context '${kubeContext}'.`);
  }

  return selectedRegion.awsProfile
}