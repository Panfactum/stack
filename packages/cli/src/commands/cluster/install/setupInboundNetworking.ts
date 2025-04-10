import { startVaultProxy } from "@/util/subprocess/vaultProxy";
import type { InstallClusterStepOptions } from "./common";

export async function setupInboundNetworking(
  options: InstallClusterStepOptions
) {
  const { checkpointer, clusterPath, context, stepNum } = options;

  const VAULT_TOKEN = await checkpointer.getSavedInput("vaultRootToken");
  const VAULT_ADDR = await checkpointer.getSavedInput("vaultAddress");
  const env = { ...process.env, VAULT_ADDR, VAULT_TOKEN };

  const pid = await startVaultProxy({
    env,
    modulePath: clusterPath,
  });
}
