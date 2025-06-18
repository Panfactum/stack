import { getEnvironments } from './getEnvironments';
import { getRegions, type RegionMeta } from './getRegions';
import type { PanfactumContext } from '@/util/context/context';

export interface AllRegionMeta extends RegionMeta {
  environment: string; // Name of the environment this region belongs to
  awsProfile: string | undefined;
}

export async function getAllRegions(context: PanfactumContext): Promise<Array<AllRegionMeta>> {
  const environments = await getEnvironments(context);
  
  // Fetch all regions in parallel
  const regionsByEnvironment = await Promise.all(
    environments.map(async (environment) => {
      const regions = await getRegions(context, environment.path);
      return { environment, regions };
    })
  );

  // Flatten the results
  const allRegions: AllRegionMeta[] = [];
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