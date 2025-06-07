import { getEnvironments } from './getEnvironments';
import { getRegions, type RegionMeta } from './getRegions';
import type { PanfactumContext } from '@/util/context/context';

export interface AllRegionMeta extends RegionMeta {
  environment: string; // Name of the environment this region belongs to
  awsProfile: string | undefined;
}

/**
 * Get all regions across all environments in the project
 * 
 * @param context - Panfactum context
 * @returns Array of all regions with their environment information
 */
export async function getAllRegions(context: PanfactumContext): Promise<Array<AllRegionMeta>> {
  const environments = await getEnvironments(context);
  const allRegions: AllRegionMeta[] = [];

  for (const environment of environments) {
    const regions = await getRegions(context, environment.path);
    
    for (const region of regions) {
      allRegions.push({
        ...region,
        environment: environment.name,
        awsProfile: environment.awsProfile
      });
    }
  }

  return allRegions;
}