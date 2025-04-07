import pc from "picocolors";
import kubeLinkerdTerragruntHcl from "../../../../templates/kube_linkerd_terragrunt.hcl" with { type: "file" };
import { ensureFileExists } from "../../../../util/ensure-file-exists";
import { tfInit } from "../../../../util/scripts/tf-init";
import { startBackgroundProcess } from "../../../../util/start-background-process";
import { writeErrorToDebugFile } from "../../../../util/write-error-to-debug-file";
import { apply } from "../terragrunt/apply";
import type { BaseContext } from "clipanion";

export const setupLinkerd = async ({
  context,
  verbose = false,
}: {
  context: BaseContext;
  verbose?: boolean;
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
  context.stdout.write("9.a. Setting up Linkerd\n");

  await ensureFileExists({
    context,
    destinationFile: "./kube_linkerd/terragrunt.hcl",
    sourceFile: await Bun.file(kubeLinkerdTerragruntHcl).text(),
  });

  tfInit({
    context,
    env,
    verbose,
    workingDirectory: "./kube_linkerd",
  });

  apply({
    context,
    env,
    verbose,
    workingDirectory: "./kube_linkerd",
  });

  // https://panfactum.com/docs/edge/guides/bootstrapping/service-mesh#control-plane-checks
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
