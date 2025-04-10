import { join } from "node:path";
import kubeCertManagerTemplate from "@/templates/kube_cert_manager_terragrunt.hcl" with { type: "file" };
import { killBackgroundProcess } from "@/util/subprocess/backgroundProcess";
import { startVaultProxy } from "@/util/subprocess/vaultProxy";
import { deployModule } from "./deployModule";
import type { InstallClusterStepOptions } from "./common";

export async function setupCertManagement(options: InstallClusterStepOptions) {
  const { checkpointer, clusterPath, context } = options;

  const modulePath = join(clusterPath, "kube_cert_manager");

  const VAULT_TOKEN = await checkpointer.getSavedInput("vaultRootToken");
  const VAULT_ADDR = await checkpointer.getSavedInput("vaultAddress");

  const env = { ...process.env, VAULT_ADDR, VAULT_TOKEN };

  const pid = await startVaultProxy({
    env,
    modulePath,
  });

  /***************************************************
   * Deploy the Cert Manager Module
   ***************************************************/
  await deployModule({
    ...options,
    stepId: "certManagerDeployment",
    stepName: "Cert Manager Deployment",
    moduleDirectory: "kube_cert_manager",
    terraguntContents: kubeCertManagerTemplate,
  });

  killBackgroundProcess({ pid, context });
}
