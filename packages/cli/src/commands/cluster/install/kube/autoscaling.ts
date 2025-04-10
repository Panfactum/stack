import path from "path";
import yaml from "yaml";
import { getPanfactumConfig } from "@/commands/config/get/getPanfactumConfig";
import kubeKarpenterNodePoolsTerragruntHcl from "../../../../templates/kube_karpenter_node_pools_terragrunt.hcl" with { type: "file" };
import kubeKarpenterTerragruntHcl from "../../../../templates/kube_karpenter_terragrunt.hcl" with { type: "file" };
import kubeKedaTerragruntHcl from "../../../../templates/kube_keda_terragrunt.hcl" with { type: "file" };
import kubeMetricsServerTerragruntHcl from "../../../../templates/kube_metrics_server_terragrunt.hcl" with { type: "file" };
import kubeSchedulerTerragruntHcl from "../../../../templates/kube_scheduler_terragrunt.hcl" with { type: "file" };
import kubeVpaTerragruntHcl from "../../../../templates/kube_vpa_terragrunt.hcl" with { type: "file" };
import { checkStepCompletion } from "../../../../util/check-step-completion";
import { safeFileExists } from "../../../../util/fs/safe-file-exists";
import { writeFile } from "../../../../util/fs/writeFile";
import { initAndApplyModule } from "../../../../util/init-and-apply-module";
import { replaceHclValue } from "../../../../util/replace-hcl-value";
import { startBackgroundProcess } from "../../../../util/subprocess/backgroundProcess";
import { updateConfigFile } from "../../../../util/update-config-file";
import { runAllApply } from "../terragrunt/run-all-apply";
import type { PanfactumContext } from "@/context/context";

export const setupAutoscaling = async ({
  configPath,
  context,
  verbose = false,
}: {
  configPath: string;
  context: PanfactumContext;
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

  const { region, environment } = await getPanfactumConfig({
    context,
  });

  // TODO: Error messages
  if (!environment) {
    throw new Error("PLACEHOLDER");
  } else if (!region) {
    throw new Error("PLACEHODLER");
  }

  const regionFilePath = path.join(
    context.repoVariables.environments_dir,
    environment,
    region,
    "region.yaml"
  );

  // https://panfactum.com/docs/edge/guides/bootstrapping/autoscaling#deploy-metrics-server
  let metricsServerSetupComplete = false;
  try {
    metricsServerSetupComplete = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "metricsServerSetup",
      stepCompleteMessage:
        "10.a. Skipping metrics server setup as it's already complete.\n",
      stepNotCompleteMessage: "10.a. Setting up the metrics server\n",
    });
  } catch {
    throw new Error("Failed to check if metrics server setup is complete");
  }

  if (!metricsServerSetupComplete) {
    await writeFile({
      context,
      path: "./kube_metrics_server/terragrunt.hcl",
      contents: await Bun.file(kubeMetricsServerTerragruntHcl).text(),
    });

    await initAndApplyModule({
      context,
      env,
      moduleName: "metrics server",
      modulePath: "./kube_metrics_server",
      verbose,
    });

    await updateConfigFile({
      updates: {
        metricsServerSetup: true,
      },
      configPath,
      context,
    });
  }

  // https://panfactum.com/docs/edge/guides/bootstrapping/autoscaling#deploy-the-vertical-pod-autoscaler
  let vpaSetupComplete = false;
  try {
    vpaSetupComplete = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "vpaSetup",
      stepCompleteMessage:
        "10.b. Skipping vertical pod autoscaler setup as it's already complete.\n",
      stepNotCompleteMessage: "10.b. Setting up the vertical pod autoscaler\n",
    });
  } catch {
    throw new Error(
      "Failed to check if vertical pod autoscaler setup is complete"
    );
  }

  if (!vpaSetupComplete) {
    await writeFile({
      context,
      path: "./kube_vpa/terragrunt.hcl",
      contents: await Bun.file(kubeVpaTerragruntHcl).text(),
    });

    await initAndApplyModule({
      context,
      env,
      moduleName: "vertical pod autoscaler",
      modulePath: "./kube_vpa",
      verbose,
    });

    await updateConfigFile({
      updates: {
        vpaSetup: true,
      },
      configPath,
      context,
    });
  }

  // Update region.yaml to enable VPA
  let vpaEnabled = false;
  try {
    vpaEnabled = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "vpaEnabled",
      stepCompleteMessage:
        "10.c. Skipping VPA in configuration as it's already complete.\n",
      stepNotCompleteMessage: "10.c. Enabling VPA in configuration\n",
    });
  } catch {
    throw new Error("Failed to check if VPA is enabled");
  }

  if (!vpaEnabled) {
    const regionFileExists = await safeFileExists(regionFilePath);
    if (!regionFileExists) {
      throw new Error(`Region file not found for ${environment}/${region}`);
    }
    const regionFile = Bun.file(regionFilePath);
    const regionFileText = await regionFile.text();
    const regionFileJson = yaml.parse(regionFileText);
    regionFileJson["extra_inputs"]["vpa_enabled"] = true;
    await Bun.write(regionFile, yaml.stringify(regionFileJson));

    await updateConfigFile({
      updates: {
        vpaEnabled: true,
      },
      configPath,
      context,
    });
  }

  let allResourcesUpdated = false;
  try {
    allResourcesUpdated = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "allResourcesUpdatedForVPA",
      stepCompleteMessage:
        "10.d. Skipping all resources update as it's already complete.\n",
      stepNotCompleteMessage: "10.d. Updating all resources to autoscale\n",
    });
  } catch {
    throw new Error("Failed to check if all resources are updated");
  }

  if (!allResourcesUpdated) {
    runAllApply({
      context,
      env,
      verbose,
      workingDirectory: "./",
    });

    await updateConfigFile({
      updates: {
        allResourcesUpdatedForVPA: true,
      },
      configPath,
      context,
    });
  }

  // https://panfactum.com/docs/edge/guides/bootstrapping/autoscaling#deploy-karpenter
  let karpenterSetupComplete = false;
  try {
    karpenterSetupComplete = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "karpenterSetup",
      stepCompleteMessage:
        "10.e. Skipping Karpenter setup as it's already complete.\n",
      stepNotCompleteMessage: "10.e. Setting up Karpenter\n",
    });
  } catch {
    throw new Error("Failed to check if Karpenter is setup");
  }

  if (!karpenterSetupComplete) {
    await writeFile({
      context,
      path: "./kube_karpenter/terragrunt.hcl",
      contents: await Bun.file(kubeKarpenterTerragruntHcl).text(),
    });

    await initAndApplyModule({
      context,
      env,
      moduleName: "Karpenter",
      modulePath: "./kube_karpenter",
      verbose,
    });

    replaceHclValue("./kube_karpenter/terragrunt.hcl", "inputs.wait", true);

    await updateConfigFile({
      updates: {
        karpenterSetup: true,
      },
      configPath,
      context,
    });
  }

  // https://panfactum.com/docs/edge/guides/bootstrapping/autoscaling#deploy-nodepools
  let nodePoolsSetupComplete = false;
  try {
    nodePoolsSetupComplete = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "nodePoolsSetup",
      stepCompleteMessage:
        "10.f. Skipping NodePools setup as it's already complete.\n",
      stepNotCompleteMessage: "10.f. Setting up NodePools\n",
    });
  } catch {
    throw new Error("Failed to check if NodePools are setup");
  }

  if (!nodePoolsSetupComplete) {
    await writeFile({
      context,
      path: "./kube_karpenter_node_pools/terragrunt.hcl",
      contents: await Bun.file(kubeKarpenterNodePoolsTerragruntHcl).text(),
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
        nodeSubnets.push(line.replace(",", "").trim());
      }
      if (line.includes("node_subnets")) {
        startCopying = true;
      }
    }

    // take in the template HCL and iterate through the subnets writing the subnets
    // Read existing content
    const updatedKarpenterNodePoolsTerragruntHclLines: string[] = [];
    const kubeKarpenterNodepoolsTerragruntHclCopy = await Bun.file(
      "./kube_karpenter_node_pools/terragrunt.hcl"
    ).text();
    const kubeKarpenterNodepoolsTerragruntHclLines =
      kubeKarpenterNodepoolsTerragruntHclCopy.split("\n");
    let writeNodePools = false;

    for (const line of kubeKarpenterNodepoolsTerragruntHclLines) {
      if (writeNodePools) {
        // write the new lines in a loop here
        // set startWriting back to false to conitue
        // add the raw string as we will call hclfmt on the file later
        updatedKarpenterNodePoolsTerragruntHclLines.push(
          nodeSubnets.map((subnet) => `${subnet}`).join(", ")
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

    await initAndApplyModule({
      context,
      env,
      moduleName: "NodePools",
      modulePath: "./kube_karpenter_node_pools",
      verbose,
    });

    await updateConfigFile({
      updates: {
        nodePoolsSetup: true,
      },
      configPath,
      context,
    });
  }

  // https://panfactum.com/docs/edge/guides/bootstrapping/autoscaling#adjust-eks-node-pools
  let eksNodePoolsAdjusted = false;
  try {
    eksNodePoolsAdjusted = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "eksNodePoolsAdjusted",
      stepCompleteMessage:
        "10.g. Skipping EKS NodePools adjustment as it's already complete.\n",
      stepNotCompleteMessage: "10.g. Adjusting EKS NodePools\n",
    });
  } catch {
    throw new Error("Failed to check if EKS NodePools are adjusted");
  }

  if (!eksNodePoolsAdjusted) {
    replaceHclValue(
      "./aws_eks/terragrunt.hcl",
      "inputs.bootstrap_mode_enabled",
      false
    );

    await initAndApplyModule({
      context,
      env,
      moduleName: "EKS NodePools",
      modulePath: "./aws_eks",
      verbose,
    });

    await updateConfigFile({
      updates: {
        eksNodePoolsAdjusted: true,
      },
      configPath,
      context,
    });
  }

  // https://panfactum.com/docs/edge/guides/bootstrapping/autoscaling#deploy-bin-packing-kubernetes-scheduler
  let binPackingKubernetesSchedulerDeployed = false;
  try {
    binPackingKubernetesSchedulerDeployed = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "binPackingKubernetesSchedulerDeployed",
      stepCompleteMessage:
        "10.h. Skipping Bin Packing Kubernetes Scheduler deployment as it's already complete.\n",
      stepNotCompleteMessage:
        "10.h. Deploying Bin Packing Kubernetes Scheduler\n",
    });
  } catch {
    throw new Error(
      "Failed to check if Bin Packing Kubernetes Scheduler is deployed"
    );
  }

  if (!binPackingKubernetesSchedulerDeployed) {
    await writeFile({
      context,
      path: "./kube_scheduler/terragrunt.hcl",
      contents: await Bun.file(kubeSchedulerTerragruntHcl).text(),
    });

    await initAndApplyModule({
      context,
      env,
      moduleName: "Bin Packing Kubernetes Scheduler",
      modulePath: "./kube_scheduler",
      verbose,
    });

    const regionFileAgain = Bun.file(regionFilePath);
    const regionFileTextAgain = await regionFileAgain.text();
    const regionFileJsonAgain = yaml.parse(regionFileTextAgain);
    regionFileJsonAgain["extra_inputs"]["panfactum_scheduler_enabled"] = true;
    await Bun.write(regionFileAgain, yaml.stringify(regionFileJsonAgain));

    await updateConfigFile({
      updates: {
        binPackingKubernetesSchedulerDeployed: true,
      },
      configPath,
      context,
    });
  }

  // KEDA
  let kedaSetupComplete = false;
  try {
    kedaSetupComplete = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "kedaSetupComplete",
      stepCompleteMessage:
        "10.i. Skipping KEDA setup as it's already complete.\n",
      stepNotCompleteMessage: "10.i. Setting up KEDA\n",
    });
  } catch {
    throw new Error("Failed to check if KEDA is setup");
  }

  if (!kedaSetupComplete) {
    await writeFile({
      context,
      path: "./kube_keda/terragrunt.hcl",
      contents: await Bun.file(kubeKedaTerragruntHcl).text(),
    });

    await initAndApplyModule({
      context,
      env,
      moduleName: "KEDA",
      modulePath: "./kube_keda",
      verbose,
    });

    await updateConfigFile({
      updates: {
        kedaSetupComplete: true,
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
