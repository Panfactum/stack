import pc from "picocolors";
import kubeLinkerdTerragruntHcl from "../../../../templates/kube_linkerd_terragrunt.hcl" with { type: "file" };
import { checkStepCompletion } from "../../../../util/check-step-completion";
import { writeFile } from "../../../../util/fs/writeFile";
import { initAndApplyModule } from "../../../../util/init-and-apply-module";
import { startBackgroundProcess } from "../../../../util/start-background-process";
import { updateConfigFile } from "../../../../util/update-config-file";
import { writeErrorToDebugFile } from "../../../../util/write-error-to-debug-file";
import type { PanfactumContext } from "@/context/context";

export const setupLinkerd = async ({
  configPath,
  context
}: {
  configPath: string;
  context: PanfactumContext;
}) => {
  const env = process.env;
  const vaultPortForwardPid = startBackgroundProcess({
    args: [
      "-n",
      "vault",
      "port-forward",
      "--address",
      "0.0.0.0",
      "svc/vault-active",
      "8200:8200",
    ],
    command: "kubectl",
    context,
    env,
  });

  // https://panfactum.com/docs/edge/guides/bootstrapping/service-mesh#deploy-linkerd2
  let setupLinkerdComplete = false;
  try {
    setupLinkerdComplete = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "linkerd",
      stepCompleteMessage:
        "9.a. Skipping Linkerd setup as it's already complete.\n",
      stepNotCompleteMessage: "9.a. Setting up Linkerd\n",
    });
  } catch {
    throw new Error("Failed to check if Linkerd setup is complete");
  }

  if (!setupLinkerdComplete) {
    await writeFile({
      context,
      path: "./kube_linkerd/terragrunt.hcl",
      contents: await Bun.file(kubeLinkerdTerragruntHcl).text(),
    });

    await initAndApplyModule({
      context,
      env,
      moduleName: "Linkerd",
      modulePath: "./kube_linkerd"
    });

    await updateConfigFile({
      updates: {
        linkerd: true,
      },
      configPath,
      context,
    });
  }

  // https://panfactum.com/docs/edge/guides/bootstrapping/service-mesh#control-plane-checks
  let linkerdControlPlaneChecksComplete = false;
  try {
    linkerdControlPlaneChecksComplete = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "linkerdControlPlaneChecks",
      stepCompleteMessage:
        "9.b. Skipping control plane checks as they're already complete.\n",
      stepNotCompleteMessage: "9.b. Running control plane checks\n",
    });
  } catch {
    throw new Error(
      "Failed to check if Linkerd control plane checks are complete"
    );
  }

  if (!linkerdControlPlaneChecksComplete) {
    context.stdout.write("9.b. Running control plane checks\n");
    const checkProcess = Bun.spawnSync(
      ["linkerd", "check", "--cni-namespace=linkerd"],
      {
        env,
      }
    );

    if (
      checkProcess.exitCode !== 0 ||
      !checkProcess.stdout.toString().includes("Status check results are √")
    ) {
      context.stderr.write(pc.red("Linkerd control plane checks failed.\n"));
      context.stderr.write(pc.red(checkProcess.stdout.toString()));
      context.stderr.write(pc.red(checkProcess.stderr.toString()));
      writeErrorToDebugFile({
        context,
        error: `Linkerd control plane checks failed: ${checkProcess.stdout.toString()}\n${checkProcess.stderr.toString()}`,
      });
      throw new Error("Linkerd control plane checks failed");
    }

    context.stdout.write(pc.green("Linkerd control plane checks passed.\n"));

    await updateConfigFile({
      updates: {
        linkerdControlPlaneChecks: true,
      },
      configPath,
      context,
    });
  }

  // To mitigate the long-running background process dying over time, we'll kill it here
  // and restart it when we need it.
  if (vaultPortForwardPid > 0) {
    try {
      process.kill(vaultPortForwardPid);
    } catch {
      // Do nothing as it's already dead
    }
  }
};
