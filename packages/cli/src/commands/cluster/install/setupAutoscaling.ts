import { join } from "node:path";
import kubeKarpenterNodePoolsTerragruntHcl from "@/templates/kube_karpenter_node_pools_terragrunt.hcl" with { type: "file" };
import kubeKarpenterTerragruntHcl from "@/templates/kube_karpenter_terragrunt.hcl" with { type: "file" };
import kubeKedaTerragruntHcl from "@/templates/kube_keda_terragrunt.hcl" with { type: "file" };
import kubeMetricsServerTerragruntHcl from "@/templates/kube_metrics_server_terragrunt.hcl" with { type: "file" };
import kubeSchedulerTerragruntHcl from "@/templates/kube_scheduler_terragrunt.hcl" with { type: "file" };
import kubeVpaTerragruntHcl from "@/templates/kube_vpa_terragrunt.hcl" with { type: "file" };
import { upsertConfigValues } from "@/util/config/upsertConfigValues";
import { writeFile } from "@/util/fs/writeFile";
import { killBackgroundProcess } from "@/util/subprocess/backgroundProcess";
import { execute } from "@/util/subprocess/execute";
import { startVaultProxy } from "@/util/subprocess/vaultProxy";
import { terragruntInitAndApply } from "@/util/terragrunt/terragruntInitAndApply";
import { deployModule } from "./deployModule";
import { informStepComplete, informStepStart } from "./messages";
import type { InstallClusterStepOptions } from "./common";

export async function setupAutoscaling(options: InstallClusterStepOptions) {
  const { checkpointer, clusterPath, context, stepNum } = options;

  const VAULT_TOKEN = await checkpointer.getSavedInput("vaultRootToken");
  const VAULT_ADDR = await checkpointer.getSavedInput("vaultAddress");
  const env = { ...process.env, VAULT_ADDR, VAULT_TOKEN };

  const pid = await startVaultProxy({
    env,
    modulePath: clusterPath,
  });

  /***************************************************
   * Deploy the Metrics Server Module
   ***************************************************/
  await deployModule({
    ...options,
    subStepNum: 1,
    stepId: "metricsServerDeployment",
    stepName: "Metrics Server Deployment",
    moduleDirectory: "kube_metrics_server",
    terraguntContents: kubeMetricsServerTerragruntHcl,
  });

  /***************************************************
   * Deploy the Vertical Pod Autoscaler Module
   ***************************************************/
  await deployModule({
    ...options,
    subStepNum: 2,
    stepId: "vpaDeployment",
    stepName: "Vertical Pod Autoscaler Deployment",
    moduleDirectory: "kube_vpa",
    terraguntContents: kubeVpaTerragruntHcl,
  });

  /***************************************************
   * Apply the VPA to all modules
   ***************************************************/
  const vpaSubStepLabel = "Applying VPA to all modules";
  const vpaSubStepNumber = 3;
  const allResourcesUpdatedForVPA = "allResourcesUpdatedForVPA";
  if (await checkpointer.isStepComplete(allResourcesUpdatedForVPA)) {
    informStepComplete(context, vpaSubStepLabel, stepNum, vpaSubStepNumber);
  } else {
    informStepStart(context, vpaSubStepLabel, stepNum, vpaSubStepNumber);

    await upsertConfigValues({
      filePath: join(clusterPath, "region.yaml"),
      values: {
        extra_inputs: {
          vpa_enabled: true,
        },
      },
    });

    const finishApplyingVPA = context.logger.progressMessage(
      "Applying VPA to all modules",
      {
        interval: 10000,
      }
    );
    await execute({
      command: [
        "terragrunt",
        "run-all",
        "apply",
        "--terragrunt-non-interactive",
      ],
      workingDirectory: clusterPath,
      env,
      context,
    });
    finishApplyingVPA();

    await checkpointer.setStepComplete(allResourcesUpdatedForVPA);
  }

  /***************************************************
   * Deploy the Karpenter Module
   ***************************************************/
  await deployModule({
    ...options,
    subStepNum: 4,
    stepId: "karpenterDeployment",
    stepName: "Karpenter Deployment",
    moduleDirectory: "kube_karpenter",
    terraguntContents: kubeKarpenterTerragruntHcl,
  });

  /***************************************************
   * Deploy the NodePools Module
   ***************************************************/
  const nodePoolsSubStepLabel = "NodePools Deployment";
  const nodePoolsSubStepNumber = 5;
  const nodePoolsStepId = "nodePoolsDeployment";
  if (await checkpointer.isStepComplete(nodePoolsStepId)) {
    informStepComplete(
      context,
      nodePoolsSubStepLabel,
      stepNum,
      nodePoolsSubStepNumber
    );
  } else {
    informStepStart(
      context,
      nodePoolsSubStepLabel,
      stepNum,
      nodePoolsSubStepNumber
    );

    const hclFilePath = join(
      clusterPath,
      "kube_karpenter_node_pools",
      "terragrunt.hcl"
    );
    await writeFile({
      context,
      path: hclFilePath,
      contents: await Bun.file(kubeKarpenterNodePoolsTerragruntHcl).text(),
      overwrite: true,
    });

    // TODO: Better HCL templating
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
    const kubeKarpenterNodepoolsTerragruntHclCopy =
      await Bun.file(hclFilePath).text();
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
    await writeFile({
      context,
      path: hclFilePath,
      contents: updatedKarpenterNodePoolsTerragruntHcl,
      overwrite: true,
    });

    // Format the file
    await execute({
      command: ["terragrunt", "hclfmt", hclFilePath],
      workingDirectory: clusterPath,
      context,
    });

    await terragruntInitAndApply({
      context,
      modulePath: hclFilePath,
    });

    await checkpointer.setStepComplete(nodePoolsStepId);
  }

  /***************************************************
   * Adjust the NodePools
   ***************************************************/
  await deployModule({
    ...options,
    subStepNum: 6,
    stepId: "adjustNodePools",
    stepName: "EKS NodePools Adjustment",
    moduleDirectory: "aws_eks",
    overwrite: false,
    hclUpdates: {
      "inputs.bootstrap_mode_enabled": false,
    },
  });

  /***************************************************
   * Deploy the Scheduler Module
   ***************************************************/
  await deployModule({
    ...options,
    subStepNum: 7,
    stepId: "schedulerDeployment",
    stepName: "Bin Packing Kubernetes Scheduler Deployment",
    moduleDirectory: "kube_scheduler",
    terraguntContents: kubeSchedulerTerragruntHcl,
  });

  await upsertConfigValues({
    filePath: join(clusterPath, "region.yaml"),
    values: {
      extra_inputs: {
        panfactum_scheduler_enabled: true,
      },
    },
  });

  /***************************************************
   * Deploy the KEDA Module
   ***************************************************/
  await deployModule({
    ...options,
    subStepNum: 8,
    stepId: "kedaDeployment",
    stepName: "KEDA Deployment",
    moduleDirectory: "kube_keda",
    terraguntContents: kubeKedaTerragruntHcl,
  });

  killBackgroundProcess({ pid, context });
}
