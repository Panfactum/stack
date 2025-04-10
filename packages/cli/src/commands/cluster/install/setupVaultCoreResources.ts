import vaultCoreResourcesTemplate from "@/templates/vault_core_resources_terragrunt.hcl" with { type: "file" };
import {
  killBackgroundProcess,
  startBackgroundProcess,
} from "@/util/subprocess/backgroundProcess";
import { deployModule } from "./deployModule";
import { informStepComplete, informStepStart } from "./messages";
import type { InstallClusterStepOptions } from "./common";

export async function setupVaultCoreResources(
  options: InstallClusterStepOptions
) {
  const { checkpointer, context, stepNum } = options;

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

    const pid = startBackgroundProcess({
      command: "kubectl",
      args: [
        "-n",
        "vault",
        "port-forward",
        "--address",
        "0.0.0.0",
        "svc/vault-active",
        "8200:8200",
      ],
      env,
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
