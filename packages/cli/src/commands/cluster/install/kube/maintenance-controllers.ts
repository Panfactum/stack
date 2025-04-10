import kubeDeschedulerTerragruntHcl from "../../../../templates/kube_descheduler_terragrunt.hcl" with { type: "file" };
import kubeExternalSnapshotterTerragruntHcl from "../../../../templates/kube_external_snapshotter_terragrunt.hcl" with { type: "file" };
import kubeNodeImageCacheControllerTerragruntHcl from "../../../../templates/kube_node_image_cache_controller_terragrunt.hcl" with { type: "file" };
import kubePvcAutoresizerTerragruntHcl from "../../../../templates/kube_pvc_autoresizer_terragrunt.hcl" with { type: "file" };
import kubeReloaderTerragruntHcl from "../../../../templates/kube_reloader_terragrunt.hcl" with { type: "file" };
import kubeVeleroTerragruntHcl from "../../../../templates/kube_velero_terragrunt.hcl" with { type: "file" };
import { checkStepCompletion } from "../../../../util/check-step-completion";
import { writeFile } from "../../../../util/fs/writeFile";
import { initAndApplyModule } from "../../../../util/init-and-apply-module";
import { updateConfigFile } from "../../../../util/update-config-file";
import type { PanfactumContext } from "@/context/context";

export const setupMaintenanceControllers = async ({
  configPath,
  context
}: {
  configPath: string;
  context: PanfactumContext;
}) => {
  // https://panfactum.com/docs/edge/guides/bootstrapping/maintenance-controllers#reloader
  let reloaderSetupComplete = false;
  try {
    reloaderSetupComplete = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "setupReloader",
      stepCompleteMessage:
        "12.a. Skipping Reloader setup as it's already complete.\n",
      stepNotCompleteMessage: "12.a. Setting up Reloader\n",
    });
  } catch {
    throw new Error("Failed to check if Reloader setup is complete");
  }

  if (!reloaderSetupComplete) {
    await writeFile({
      context,
      path: "./kube_reloader/terragrunt.hcl",
      contents: await Bun.file(kubeReloaderTerragruntHcl).text(),
    });

    await initAndApplyModule({
      context,
      moduleName: "Reloader",
      modulePath: "./kube_reloader"
    });

    await updateConfigFile({
      context,
      configPath,
      updates: { setupReloader: true },
    });
  }

  // https://panfactum.com/docs/edge/guides/bootstrapping/maintenance-controllers#node-image-caches
  let nodeImageCachesSetupComplete = false;
  try {
    nodeImageCachesSetupComplete = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "setupNodeImageCaches",
      stepCompleteMessage:
        "12.b. Skipping Node Image Caches setup as it's already complete.\n",
      stepNotCompleteMessage: "12.b. Setting up Node Image Caches\n",
    });
  } catch {
    throw new Error("Failed to check if Node Image Caches setup is complete");
  }

  if (!nodeImageCachesSetupComplete) {
    await writeFile({
      context,
      path: "./kube_node_image_cache_controller/terragrunt.hcl",
      contents: await Bun.file(
        kubeNodeImageCacheControllerTerragruntHcl
      ).text(),
    });

    await initAndApplyModule({
      context,
      moduleName: "Node Image Caches",
      modulePath: "./kube_node_image_cache_controller"
    });

    await updateConfigFile({
      context,
      configPath,
      updates: { setupNodeImageCaches: true },
    });
  }

  // https://panfactum.com/docs/edge/guides/bootstrapping/maintenance-controllers#pvc-autoresizer
  let pvcAutoresizerSetupComplete = false;
  try {
    pvcAutoresizerSetupComplete = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "setupPvcAutoresizer",
      stepCompleteMessage:
        "12.c. Skipping PVC Autoresizer setup as it's already complete.\n",
      stepNotCompleteMessage: "12.c. Setting up PVC Autoresizer\n",
    });
  } catch {
    throw new Error("Failed to check if PVC Autoresizer setup is complete");
  }

  if (!pvcAutoresizerSetupComplete) {
    await writeFile({
      context,
      path: "./kube_pvc_autoresizer/terragrunt.hcl",
      contents: await Bun.file(kubePvcAutoresizerTerragruntHcl).text(),
    });

    await initAndApplyModule({
      context,
      moduleName: "PVC Autoresizer",
      modulePath: "./kube_pvc_autoresizer"
    });

    await updateConfigFile({
      context,
      configPath,
      updates: { setupPvcAutoresizer: true },
    });
  }

  // https://panfactum.com/docs/edge/guides/bootstrapping/maintenance-controllers#descheduler
  let deschedulerSetupComplete = false;
  try {
    deschedulerSetupComplete = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "setupDescheduler",
      stepCompleteMessage:
        "12.d. Skipping Descheduler setup as it's already complete.\n",
      stepNotCompleteMessage: "12.d. Setting up Descheduler\n",
    });
  } catch {
    throw new Error("Failed to check if Descheduler setup is complete");
  }

  if (!deschedulerSetupComplete) {
    await writeFile({
      context,
      path: "./kube_descheduler/terragrunt.hcl",
      contents: await Bun.file(kubeDeschedulerTerragruntHcl).text(),
    });

    await initAndApplyModule({
      context,
      moduleName: "Descheduler",
      modulePath: "./kube_descheduler"
    });

    await updateConfigFile({
      context,
      configPath,
      updates: { setupDescheduler: true },
    });
  }

  // https://panfactum.com/docs/edge/guides/bootstrapping/maintenance-controllers#deploy-the-external-snapshotter
  let externalSnapshotterSetupComplete = false;
  try {
    externalSnapshotterSetupComplete = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "setupExternalSnapshotter",
      stepCompleteMessage:
        "12.e. Skipping External Snapshotter setup as it's already complete.\n",
      stepNotCompleteMessage: "12.e. Setting up External Snapshotter\n",
    });
  } catch {
    throw new Error(
      "Failed to check if External Snapshotter setup is complete"
    );
  }

  if (!externalSnapshotterSetupComplete) {
    await writeFile({
      context,
      path: "./kube_external_snapshotter/terragrunt.hcl",
      contents: await Bun.file(kubeExternalSnapshotterTerragruntHcl).text(),
    });

    await initAndApplyModule({
      context,
      moduleName: "External Snapshotter",
      modulePath: "./kube_external_snapshotter"
    });

    await updateConfigFile({
      context,
      configPath,
      updates: { setupExternalSnapshotter: true },
    });
  }

  // https://panfactum.com/docs/edge/guides/bootstrapping/maintenance-controllers#deploy-velero
  let veleroSetupComplete = false;
  try {
    veleroSetupComplete = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "setupVelero",
      stepCompleteMessage:
        "12.f. Skipping Velero setup as it's already complete.\n",
      stepNotCompleteMessage: "12.f. Setting up Velero\n",
    });
  } catch {
    throw new Error("Failed to check if Velero setup is complete");
  }

  if (!veleroSetupComplete) {
    await writeFile({
      context,
      path: "./kube_velero/terragrunt.hcl",
      contents: await Bun.file(kubeVeleroTerragruntHcl).text(),
    });

    await initAndApplyModule({
      context,
      moduleName: "Velero",
      modulePath: "./kube_velero"
    });

    await updateConfigFile({
      context,
      configPath,
      updates: { setupVelero: true },
    });
  }
};
