import { join } from "node:path";
import { getEnvironments } from "@/util/config/getEnvironments";
import { getRegions } from "@/util/config/getRegions";
import { MODULES } from "@/util/terragrunt/constants";
import { getModuleStatus } from "@/util/terragrunt/getModuleStatus";
import type { PanfactumContext } from "@/util/context/context";

interface AuthenticLocation {
    path: string;
    environmentName: string;
    regionName: string;
}

/**
 * Finds the location where kube_authentik module is installed in a Panfactum setup.
 * Internal function that returns full location information.
 */
export async function findAuthentikLocation(context: PanfactumContext): Promise<AuthenticLocation | null> {
    const environments = await getEnvironments(context);
    
    for (const environment of environments) {
        const regions = await getRegions(context, environment.path);
        
        for (const region of regions) {
          const authentikPath = join(region.path, MODULES.KUBE_AUTHENTIK);

          // Check if it's actually deployed
          const moduleStatus = await getModuleStatus({
            context,
            environment: environment.name,
            region: region.name,
            module: MODULES.KUBE_AUTHENTIK,
          });

          if (moduleStatus.deploy_status === "success") {
            // todo: return env and region object vs value
            return {
                path: authentikPath,
                environmentName: environment.name,
                regionName: region.name
            };
          }
        }
    }

    return null;
}