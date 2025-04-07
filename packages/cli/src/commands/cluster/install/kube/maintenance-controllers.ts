import kubeDeschedulerTerragruntHcl from "../../../../templates/kube_descheduler_terragrunt.hcl" with { type: "file" };
import kubeExternalSnapshotterTerragruntHcl from "../../../../templates/kube_external_snapshotter_terragrunt.hcl" with { type: "file" };
import kubeNodeImageCacheControllerTerragruntHcl from "../../../../templates/kube_node_image_cache_controller_terragrunt.hcl" with { type: "file" };
import kubePvcAutoresizerTerragruntHcl from "../../../../templates/kube_pvc_autoresizer_terragrunt.hcl" with { type: "file" };
import kubeReloaderTerragruntHcl from "../../../../templates/kube_reloader_terragrunt.hcl" with { type: "file" };
import kubeVeleroTerragruntHcl from "../../../../templates/kube_velero_terragrunt.hcl" with { type: "file" };
import { ensureFileExists } from "../../../../util/ensure-file-exists";
import { tfInit } from "../../../../util/scripts/tf-init";
import { apply } from "../terragrunt/apply";
import type { BaseContext } from "clipanion";

export const setupMaintenanceControllers = async ({
  context,
  verbose = false,
}: {
  context: BaseContext;
  verbose?: boolean;
}) => {
  // https://panfactum.com/docs/edge/guides/bootstrapping/maintenance-controllers#reloader
  context.stdout.write("12.a. Setting up Reloader\n");

  await ensureFileExists({
    context,
    destinationFile: "./kube_reloader/terragrunt.hcl",
    sourceFile: await Bun.file(kubeReloaderTerragruntHcl).text(),
  });

  tfInit({
    context,
    verbose,
    workingDirectory: "./kube_reloader",
  });

  apply({
    context,
    verbose,
    workingDirectory: "./kube_reloader",
  });

  // https://panfactum.com/docs/edge/guides/bootstrapping/maintenance-controllers#node-image-caches
  context.stdout.write("12.b. Setting up Node Image Caches\n");

  await ensureFileExists({
    context,
    destinationFile: "./kube_node_image_cache_controller/terragrunt.hcl",
    sourceFile: await Bun.file(
      kubeNodeImageCacheControllerTerragruntHcl
    ).text(),
  });

  tfInit({
    context,
    verbose,
    workingDirectory: "./kube_node_image_cache_controller",
  });

  apply({
    context,
    verbose,
    workingDirectory: "./kube_node_image_cache_controller",
  });

  // https://panfactum.com/docs/edge/guides/bootstrapping/maintenance-controllers#pvc-autoresizer
  context.stdout.write("12.c. Setting up PVC Autoresizer\n");

  await ensureFileExists({
    context,
    destinationFile: "./kube_pvc_autoresizer/terragrunt.hcl",
    sourceFile: await Bun.file(kubePvcAutoresizerTerragruntHcl).text(),
  });

  tfInit({
    context,
    verbose,
    workingDirectory: "./kube_pvc_autoresizer",
  });

  apply({
    context,
    verbose,
    workingDirectory: "./kube_pvc_autoresizer",
  });

  // https://panfactum.com/docs/edge/guides/bootstrapping/maintenance-controllers#descheduler
  context.stdout.write("12.d. Setting up Descheduler\n");

  await ensureFileExists({
    context,
    destinationFile: "./kube_descheduler/terragrunt.hcl",
    sourceFile: await Bun.file(kubeDeschedulerTerragruntHcl).text(),
  });

  tfInit({
    context,
    verbose,
    workingDirectory: "./kube_descheduler",
  });

  apply({
    context,
    verbose,
    workingDirectory: "./kube_descheduler",
  });

  // https://panfactum.com/docs/edge/guides/bootstrapping/maintenance-controllers#deploy-the-external-snapshotter
  context.stdout.write("12.e. Setting up External Snapshotter\n");

  await ensureFileExists({
    context,
    destinationFile: "./kube_external_snapshotter/terragrunt.hcl",
    sourceFile: await Bun.file(kubeExternalSnapshotterTerragruntHcl).text(),
  });

  tfInit({
    context,
    verbose,
    workingDirectory: "./kube_external_snapshotter",
  });

  apply({
    context,
    verbose,
    workingDirectory: "./kube_external_snapshotter",
  });

  // https://panfactum.com/docs/edge/guides/bootstrapping/maintenance-controllers#deploy-velero
  context.stdout.write("12.f. Setting up Velero\n");

  await ensureFileExists({
    context,
    destinationFile: "./kube_velero/terragrunt.hcl",
    sourceFile: await Bun.file(kubeVeleroTerragruntHcl).text(),
  });

  tfInit({
    context,
    verbose,
    workingDirectory: "./kube_velero",
  });

  apply({
    context,
    verbose,
    workingDirectory: "./kube_velero",
  });
};
