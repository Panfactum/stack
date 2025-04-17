import { join } from "node:path";
import vaultCoreResourcesTemplate from "@/templates/vault_core_resources_terragrunt.hcl" with { type: "file" };
import { killBackgroundProcess } from "@/util/subprocess/backgroundProcess";
import { startVaultProxy } from "@/util/subprocess/vaultProxy";
import { deployModule } from "./deployModule";
import { informStepComplete, informStepStart } from "./messages";
import type { InstallClusterStepOptions } from "./common";

export async function setupVaultCoreResources(
  options: InstallClusterStepOptions
) {
  const { checkpointer, clusterPath, context, stepNum } = options;
  const modulePath = join(clusterPath, "vault_core_resources");

  /***************************************************
   * Initialize Vault
   ***************************************************/
  const subStepLabel = "Vault Core Resources";
  const vaultCoreResourcesStepId = "setupVaultCoreResources";
  if (await checkpointer.isStepComplete(vaultCoreResourcesStepId)) {
    informStepComplete(context, subStepLabel, stepNum);
  } else {
    informStepStart(context, subStepLabel, stepNum);

    const VAULT_TOKEN = await checkpointer.getSavedInput("vaultRootToken");
    const VAULT_ADDR = await checkpointer.getSavedInput("vaultAddress");

    const env = { ...process.env, VAULT_ADDR, VAULT_TOKEN };

    const pid = await startVaultProxy({
      env,
      modulePath,
    });

    await deployModule({
      ...options,
      stepId: "vaultCoreResourcesDeployment",
      stepName: "Vault Core Resources Deployment",
      moduleDirectory: "vault_core_resources",
      terraguntContents: vaultCoreResourcesTemplate,
    });

    killBackgroundProcess({ pid, context });
  }
}
