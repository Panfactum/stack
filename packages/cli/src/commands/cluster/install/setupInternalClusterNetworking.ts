import kubeCiliumTerragruntHcl from "@/templates/kube_cilium_terragrunt.hcl" with { type: "file" };
import kubeCoreDnsTerragruntHcl from "@/templates/kube_core_dns_terragrunt.hcl" with { type: "file" };
import { deployModule } from "./deployModule";
import type { InstallClusterStepOptions } from "./common";

export async function setupInternalClusterNetworking(
  options: InstallClusterStepOptions
) {
  const { stepNum } = options;

  /***************************************************
   * Deploy the Cilium Module
   ***************************************************/
  await deployModule({
    ...options,
    stepId: "setupCilium",
    stepName: "Cilium Setup",
    module: "kube_cilium",
    terraguntContents: kubeCiliumTerragruntHcl,
    stepNum,
    subStepNum: 1,
  });

  /***************************************************
   * Deploy the CoreDNS Module
   ***************************************************/
  await deployModule({
    ...options,
    stepId: "setupCoreDNS",
    stepName: "CoreDNS Setup",
    module: "kube_core_dns",
    terraguntContents: kubeCoreDnsTerragruntHcl,
    stepNum,
    subStepNum: 2,
  });
}
