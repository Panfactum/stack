import kubeCiliumTerragruntHcl from "../../templates/kube_cilium_terragrunt.hcl" with { type: "file" };
import kubeCoreDnsTerragruntHcl from "../../templates/kube_core_dns_terragrunt.hcl" with { type: "file" };
import { checkStepCompletion } from "../../util/check-step-completion";
import { ensureFileExists } from "../../util/ensure-file-exists";
import { initAndApplyModule } from "../../util/init-and-apply-module";
import { updateConfigFile } from "../../util/update-config-file";
import type { BaseContext } from "clipanion";

export async function setupInternalClusterNetworking({
  context,
  configPath,
  verbose,
}: {
  context: BaseContext;
  configPath: string;
  verbose?: boolean;
}) {
  // https://panfactum.com/docs/edge/guides/bootstrapping/internal-cluster-networking#deploy-cilium
  let ciliumIaCSetupComplete = false;
  try {
    ciliumIaCSetupComplete = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "setupCilium",
      stepCompleteMessage:
        "4.a. Skipping Cilium setup as it's already complete.\n",
      stepNotCompleteMessage: "4.a. Setting up Cilium\n",
    });
  } catch {
    throw new Error(
      "Failed to check if Cilium module installation is complete"
    );
  }

  if (!ciliumIaCSetupComplete) {
    await ensureFileExists({
      context,
      destinationFile: "./kube_cilium/terragrunt.hcl",
      sourceFile: await Bun.file(kubeCiliumTerragruntHcl).text(),
    });

    await initAndApplyModule({
      context,
      moduleName: "Cilium",
      modulePath: "./kube_cilium",
      verbose,
    });

    await updateConfigFile({
      updates: {
        setupCilium: true,
      },
      configPath,
      context,
    });
  }

  // https://panfactum.com/docs/edge/guides/bootstrapping/internal-cluster-networking#deploy-coredns
  let coreDnsIaCSetupComplete = false;
  try {
    coreDnsIaCSetupComplete = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "setupCoreDns",
      stepCompleteMessage:
        "4.b. Skipping CoreDNS setup as it's already complete.\n",
      stepNotCompleteMessage: "4.b. Setting up CoreDNS\n",
    });
  } catch {
    throw new Error(
      "Failed to check if CoreDNS module installation is complete"
    );
  }

  if (!coreDnsIaCSetupComplete) {
    await ensureFileExists({
      context,
      destinationFile: "./kube_core_dns/terragrunt.hcl",
      sourceFile: await Bun.file(kubeCoreDnsTerragruntHcl).text(),
    });

    await initAndApplyModule({
      context,
      moduleName: "CoreDNS",
      modulePath: "./kube_core_dns",
      verbose,
    });

    await updateConfigFile({
      updates: {
        setupCoreDns: true,
      },
      configPath,
      context,
    });
  }
}
