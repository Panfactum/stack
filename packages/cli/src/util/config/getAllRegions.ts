// This file provides utilities for retrieving all AWS regions across all environments
// It aggregates region information from multiple Panfactum environments

import { getEnvironments } from './getEnvironments';
import { getRegions, type IRegionMeta } from './getRegions';
import type { PanfactumContext } from '@/util/context/context';

/**
 * Extended region metadata that includes environment information
 * 
 * @remarks
 * Extends the base RegionMeta with environment context, allowing
 * regions to be traced back to their parent environment.
 */
export interface IAllRegionMeta extends IRegionMeta {
  /** Name of the environment this region belongs to */
  environment: string;
  /** AWS profile to use (inherited from region or environment) */
  awsProfile: string | undefined;
}

/**
 * Retrieves all configured AWS regions across all Panfactum environments
 * 
 * @remarks
 * This function:
 * 1. Fetches all configured environments
 * 2. Retrieves regions for each environment in parallel
 * 3. Flattens the results into a single array
 * 4. Enriches each region with environment context
 * 5. Inherits AWS profile from environment if not specified at region level
 * 
 * This is useful for operations that need to work across all regions
 * in a Panfactum deployment, such as global resource cleanup or
 * cross-region reporting.
 * 
 * @param context - Panfactum context for configuration access
 * @returns Array of all regions with environment metadata
 * 
 * @example
 * ```typescript
 * const allRegions = await getAllRegions(context);
 * console.log(`Found ${allRegions.length} regions across all environments`);
 * 
 * // Group regions by environment
 * const byEnv = allRegions.reduce((acc, region) => {
 *   acc[region.environment] = acc[region.environment] || [];
 *   acc[region.environment].push(region);
 *   return acc;
 * }, {});
 * ```
 * 
 * @see {@link getEnvironments} - For fetching environment list
 * @see {@link getRegions} - For fetching regions per environment
 */
export async function getAllRegions(context: PanfactumContext): Promise<Array<IAllRegionMeta>> {
  const environments = await getEnvironments(context);
  
  // Fetch all regions in parallel
  const regionsByEnvironment = await Promise.all(
    environments.map(async (environment) => {
      const regions = await getRegions(context, environment.path);
      return { environment, regions };
    })
  );

  // Flatten the results
  const allRegions: IAllRegionMeta[] = [];
  for (const { environment, regions } of regionsByEnvironment) {
    for (const region of regions) {
      allRegions.push({
        ...region,
        environment: environment.name,
        awsProfile: region.awsProfile ?? environment.awsProfile
      });
    }
  }

  return allRegions;
}