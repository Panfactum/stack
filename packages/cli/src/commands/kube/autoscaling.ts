import path from "path";
import yaml from "yaml";
import kubeKarpenterTerragruntHcl from "../../templates/kube_karpenter_terragrunt.hcl" with { type: "file" };
import kubeMetricsServerTerragruntHcl from "../../templates/kube_metrics_server_terragrunt.hcl" with { type: "file" };
import kubeSchedulerTerragruntHcl from "../../templates/kube_scheduler_terragrunt.hcl" with { type: "file" };
import kubeVpaTerragruntHcl from "../../templates/kube_vpa_terragrunt.hcl" with { type: "file" };
import { ensureFileExists } from "../../util/ensure-file-exists";
import { replaceHclValue } from "../../util/replace-hcl-value";
import { safeFileExists } from "../../util/safe-file-exists";
import { getRepoVariables } from "../../util/scripts/get-repo-variables";
import { getTerragruntVariables } from "../../util/scripts/get-terragrunt-variables";
import { tfInit } from "../../util/scripts/tf-init";
import { startBackgroundProcess } from "../../util/start-background-process";
import { apply } from "../terragrunt/apply";
import { runAllApply } from "../terragrunt/run-all-apply";
import type { BaseContext } from "clipanion";

export const setupAutoscaling = async ({
  context,
  verbose = false,
}: {
  context: BaseContext;
  verbose?: boolean;
}) => {
  const env = process.env;
  let vaultPortForwardPid = 0;
  vaultPortForwardPid = startBackgroundProcess({
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

  // https://panfactum.com/docs/edge/guides/bootstrapping/autoscaling#deploy-metrics-server
  context.stdout.write("10.a. Setting up the metrics server\n");

  await ensureFileExists({
    context,
    destinationFile: "./kube_metrics_server/terragrunt.hcl",
    sourceFile: await Bun.file(kubeMetricsServerTerragruntHcl).text(),
  });

  tfInit({
    context,
    env,
    verbose,
    workingDirectory: "./kube_metrics_server",
  });

  apply({
    context,
    env,
    verbose,
    workingDirectory: "./kube_metrics_server",
  });

  // https://panfactum.com/docs/edge/guides/bootstrapping/autoscaling#deploy-the-vertical-pod-autoscaler
  context.stdout.write("10.b. Setting up the vertical pod   autoscaler\n");

  await ensureFileExists({
    context,
    destinationFile: "./kube_vpa/terragrunt.hcl",
    sourceFile: await Bun.file(kubeVpaTerragruntHcl).text(),
  });

  tfInit({
    context,
    env,
    verbose,
    workingDirectory: "./kube_vpa",
  });

  apply({
    context,
    env,
    verbose,
    workingDirectory: "./kube_vpa",
  });

  // Update region.yaml to enable VPA
  context.stdout.write("10.c. Enabling VPA in configuration\n");

  const repoVariables = await getRepoVariables({
    context,
  });
  const terragruntVariables = await getTerragruntVariables({
    context,
  });
  const regionFilePath = path.join(
    repoVariables.environments_dir,
    terragruntVariables["environment"],
    terragruntVariables["region"],
    "region.yaml"
  );
  const regionFileExists = await safeFileExists(regionFilePath);
  if (!regionFileExists) {
    throw new Error(
      `Region file not found for ${terragruntVariables["environment"]}/${terragruntVariables["region"]}`
    );
  }
  const regionFile = Bun.file(regionFilePath);
  const regionFileText = await regionFile.text();
  const regionFileJson = yaml.parse(regionFileText);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  regionFileJson["extra_inputs"]["vpa_enabled"] = true;
  await Bun.write(regionFile, yaml.stringify(regionFileJson));

  context.stdout.write("10.d. Updating all resources to autoscale\n");

  runAllApply({
    context,
    env,
    verbose,
    workingDirectory: "./",
  });

  // https://panfactum.com/docs/edge/guides/bootstrapping/autoscaling#deploy-karpenter
  context.stdout.write("10.e. Setting up Karpenter\n");

  await ensureFileExists({
    context,
    destinationFile: "./kube_karpenter/terragrunt.hcl",
    sourceFile: await Bun.file(kubeKarpenterTerragruntHcl).text(),
  });

  tfInit({
    context,
    env,
    verbose,
    workingDirectory: "./kube_karpenter",
  });

  apply({
    context,
    env,
    verbose,
    workingDirectory: "./kube_karpenter",
  });

  replaceHclValue("./kube_karpenter/terragrunt.hcl", "inputs.wait", true);

  // https://panfactum.com/docs/edge/guides/bootstrapping/autoscaling#deploy-nodepools
  context.stdout.write("10.f. Setting up NodePools\n");

  await ensureFileExists({
    context,
    destinationFile: "./kube_karpenter_node_pools/terragrunt.hcl",
    sourceFile: await Bun.file(kubeKarpenterTerragruntHcl).text(),
  });

  const nodeSubnets: string[] = [];
  // Get the subnets from the aws_eks module
  const eksTerragruntHcl = await Bun.file("./aws_eks/terragrunt.hcl").text();
  const eksTerragruntHclLines = eksTerragruntHcl.split("\n");
  let startCopying = false;
  for (const line of eksTerragruntHclLines) {
    if (startCopying) {
      if (line.includes("]")) {
        break;
      }
      nodeSubnets.push(line.replace(",", "").replace('"', "").trim());
    }
    if (line.includes("node_subnets")) {
      startCopying = true;
    }
  }

  // take in the template HCL and iterate through the subnets writing the subnets
  // Read existing content
  const updatedKarpenterNodePoolsTerragruntHclLines: string[] = [];
  const kubeKarpenterNodepoolsTerragruntHcl = await Bun.file(
    "./kube_karpenter_node_pools/terragrunt.hcl"
  ).text();
  const kubeKarpenterNodepoolsTerragruntHclLines =
    kubeKarpenterNodepoolsTerragruntHcl.split("\n");
  let writeNodePools = false;

  for (const line of kubeKarpenterNodepoolsTerragruntHclLines) {
    if (writeNodePools) {
      // write the new lines in a loop here
      // set startWriting back to false to conitue
      // add the raw string as we will call hclfmt on the file later
      updatedKarpenterNodePoolsTerragruntHclLines.push(
        nodeSubnets.map((subnet) => `"${subnet}"`).join(", ")
      );
      writeNodePools = false;
    }

    updatedKarpenterNodePoolsTerragruntHclLines.push(line);

    // We want to insert the subnets after the start of this block
    if (line.includes("node_subnets")) {
      writeNodePools = true;
    }
  }
  const updatedKarpenterNodePoolsTerragruntHcl =
    updatedKarpenterNodePoolsTerragruntHclLines.join("\n");

  // Write the updated template HCL to the file
  await Bun.write(
    "./kube_karpenter_node_pools/terragrunt.hcl",
    updatedKarpenterNodePoolsTerragruntHcl
  );

  // Format the file
  Bun.spawnSync([
    "terragrunt",
    "hclfmt",
    "./kube_karpenter_node_pools/terragrunt.hcl",
  ]);

  tfInit({
    context,
    env,
    verbose,
    workingDirectory: "./kube_karpenter_node_pools",
  });

  apply({
    context,
    env,
    verbose,
    workingDirectory: "./kube_karpenter_node_pools",
  });

  // https://panfactum.com/docs/edge/guides/bootstrapping/autoscaling#adjust-eks-node-pools
  context.stdout.write("10.g. Adjusting EKS Node Pools\n");

  replaceHclValue(
    "./aws_eks/terragrunt.hcl",
    "inputs.bootstrap_mode_enabled",
    false
  );

  tfInit({
    context,
    env,
    verbose,
    workingDirectory: "./aws_eks",
  });

  apply({
    context,
    env,
    verbose,
    workingDirectory: "./aws_eks",
  });

  // https://panfactum.com/docs/edge/guides/bootstrapping/autoscaling#deploy-bin-packing-kubernetes-scheduler
  context.stdout.write("10.h. Deploying Bin Packing Kubernetes Scheduler\n");

  await ensureFileExists({
    context,
    destinationFile: "./kube_scheduler/terragrunt.hcl",
    sourceFile: await Bun.file(kubeSchedulerTerragruntHcl).text(),
  });

  tfInit({
    context,
    env,
    verbose,
    workingDirectory: "./kube_scheduler",
  });

  apply({
    context,
    env,
    verbose,
    workingDirectory: "./kube_scheduler",
  });

  const regionFileAgain = Bun.file(regionFilePath);
  const regionFileTextAgain = await regionFileAgain.text();
  const regionFileJsonAgain = yaml.parse(regionFileTextAgain);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  regionFileJsonAgain["extra_inputs"]["panfactum_scheduler_enabled"] = true;
  await Bun.write(regionFileAgain, yaml.stringify(regionFileJsonAgain));

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
