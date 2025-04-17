import kubeDeschedulerTerragruntHcl from "@/templates/kube_descheduler_terragrunt.hcl" with { type: "file" };
import kubeExternalSnapshotterTerragruntHcl from "@/templates/kube_external_snapshotter_terragrunt.hcl" with { type: "file" };
import kubeNodeImageCacheControllerTerragruntHcl from "@/templates/kube_node_image_cache_controller_terragrunt.hcl" with { type: "file" };
import kubePvcAutoresizerTerragruntHcl from "@/templates/kube_pvc_autoresizer_terragrunt.hcl" with { type: "file" };
import kubeReloaderTerragruntHcl from "@/templates/kube_reloader_terragrunt.hcl" with { type: "file" };
import kubeVeleroTerragruntHcl from "@/templates/kube_velero_terragrunt.hcl" with { type: "file" };
import { deployModule } from "./deployModule";
import type { InstallClusterStepOptions } from "./common";

export async function setupMaintenanceControllers(
  options: InstallClusterStepOptions
) {
  /***************************************************
   * Deploy the Reloader Module
   ***************************************************/
  await deployModule({
    ...options,
    subStepNum: 1,
    moduleDirectory: "kube_reloader",
    terraguntContents: await Bun.file(kubeReloaderTerragruntHcl).text(),
    stepName: "Reloader Deployment",
    stepId: "deployReloader",
  });

  /***************************************************
   * Deploy the Node Image Caches Module
   ***************************************************/
  await deployModule({
    ...options,
    subStepNum: 2,
    moduleDirectory: "kube_node_image_cache_controller",
    terraguntContents: kubeNodeImageCacheControllerTerragruntHcl,
    stepName: "Node Image Caches Deployment",
    stepId: "deployNodeImageCaches",
  });

  /***************************************************
   * Deploy the PVC Autoresizer Module
   ***************************************************/
  await deployModule({
    ...options,
    subStepNum: 3,
    moduleDirectory: "kube_pvc_autoresizer",
    terraguntContents: kubePvcAutoresizerTerragruntHcl,
    stepName: "PVC Autoresizer Deployment",
    stepId: "deployPvcAutoresizer",
  });

  /***************************************************
   * Deploy the Descheduler Module
   ***************************************************/
  await deployModule({
    ...options,
    subStepNum: 4,
    moduleDirectory: "kube_descheduler",
    terraguntContents: kubeDeschedulerTerragruntHcl,
    stepName: "Descheduler Deployment",
    stepId: "deployDescheduler",
  });

  /***************************************************
   * Deploy the External Snapshotter Module
   ***************************************************/
  await deployModule({
    ...options,
    subStepNum: 5,
    moduleDirectory: "kube_external_snapshotter",
    terraguntContents: kubeExternalSnapshotterTerragruntHcl,
    stepName: "External Snapshotter Deployment",
    stepId: "deployExternalSnapshotter",
  });

  /***************************************************
   * Deploy the Velero Module
   ***************************************************/
  await deployModule({
    ...options,
    subStepNum: 6,
    moduleDirectory: "kube_velero",
    terraguntContents: kubeVeleroTerragruntHcl,
    stepName: "Velero Deployment",
    stepId: "deployVelero",
  });
}
