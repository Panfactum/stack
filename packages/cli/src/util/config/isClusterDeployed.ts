import { MODULES } from "@/util/terragrunt/constants";
import { getModuleStatus } from "@/util/terragrunt/getModuleStatus";
import type { PanfactumContext } from "@/util/context/context";

export async function isClusterDeployed(inputs: { context: PanfactumContext, environment: string, region: string }) {
  const { context, environment, region } = inputs;

  const status = await getModuleStatus({
    context,
    region,
    environment,
    module: MODULES.KUBE_RELOADER
  })
  return status.deploy_status === "success"
}