import { join } from "node:path";
import kubeLinkerdTerragruntHcl from "@/templates/kube_linkerd_terragrunt.hcl" with { type: "file" };
import { killBackgroundProcess } from "@/util/subprocess/backgroundProcess";
import { execute } from "@/util/subprocess/execute";
import { startVaultProxy } from "@/util/subprocess/vaultProxy";
import { deployModule } from "./deployModule";
import { informStepComplete, informStepStart } from "./messages";
import type { InstallClusterStepOptions } from "./common";

export async function setupLinkerd(options: InstallClusterStepOptions) {
  const { checkpointer, clusterPath, context, stepNum } = options;

  const modulePath = join(clusterPath, "kube_linkerd");

  const VAULT_TOKEN = await checkpointer.getSavedInput("vaultRootToken");
  const VAULT_ADDR = await checkpointer.getSavedInput("vaultAddress");
  const env = { ...process.env, VAULT_ADDR, VAULT_TOKEN };

  const pid = await startVaultProxy({
    env,
    modulePath,
  });

  /***************************************************
   * Deploy the Linkerd Module
   ***************************************************/
  await deployModule({
    ...options,
    stepId: "linkerdDeployment",
    stepName: "Linkerd Deployment",
    moduleDirectory: "kube_linkerd",
    terraguntContents: kubeLinkerdTerragruntHcl,
    subStepNum: 1,
  });

  /***************************************************
   * Run the Linkerd Control Plane Checks
   ***************************************************/
  const subStepLabel = "Linkerd Control Plane Checks";
  const subStepNumber = 2;
  const linkerdControlPlaneChecksStepId = "linkerdControlPlaneChecks";
  if (await checkpointer.isStepComplete(linkerdControlPlaneChecksStepId)) {
    informStepComplete(context, subStepLabel, stepNum, subStepNumber);
  } else {
    informStepStart(context, subStepLabel, stepNum, subStepNumber);

    await execute({
      command: ["linkerd", "check", "--cni-namespace=linkerd"],
      context,
      workingDirectory: process.cwd(),
      errorMessage: "Linkerd control plane checks failed",
      isSuccess: ({ exitCode, stdout }) =>
        exitCode === 0 ||
        (stdout as string).includes("Status check results are √"),
      env,
    });

    await checkpointer.setStepComplete(linkerdControlPlaneChecksStepId);
  }

  killBackgroundProcess({ pid, context });
}
