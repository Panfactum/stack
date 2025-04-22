import path from "node:path";
import { input } from "@inquirer/prompts";
import pc from "picocolors";
import awsEksSla1Template from "@/templates/aws_eks_sla_1_terragrunt.hcl" with { type: "file" };
import awsEksSla2Template from "@/templates/aws_eks_sla_2_terragrunt.hcl" with { type: "file" };
import { upsertConfigValues } from "@/util/config/upsertConfigValues";
import { CLUSTER_DESCRIPTION, CLUSTER_NAME } from "./checkpointer";
import { deployModule } from "./deployModule";
import type { InstallClusterStepOptions } from "./common";

const clusterNameFormatter = (input: string): string => {
  return input.toLowerCase().replace(/[^a-z0-9-]/g, "-");
};

export async function setupEKS(options: InstallClusterStepOptions) {
  const { checkpointer, clusterPath, environment, region, slaTarget, stepNum } =
    options;

  /***************************************************
   * Get the user-provided config for EKS
   ***************************************************/
  let [clusterName, clusterDescription] = await Promise.all([
    checkpointer.getSavedInput("clusterName"),
    checkpointer.getSavedInput("clusterDescription"),
  ]);

  if (!clusterName) {
    clusterName = await input({
      message: pc.magenta("Enter a name for your Kubernetes cluster:"),
      required: true,
      default: `${environment}-${region}`,
      transformer: (value) => clusterNameFormatter(value),
      validate: (value) => {
        const transformed = clusterNameFormatter(value);
        const { error } = CLUSTER_NAME.safeParse(transformed);
        if (error) {
          return error.issues[0]?.message ?? "Invalid cluster name";
        } else {
          return true;
        }
      },
    });
    clusterName = clusterNameFormatter(clusterName);
    checkpointer.updateSavedInput("clusterName", clusterName);
  }

  if (!clusterDescription) {
    clusterDescription = await input({
      message: "Enter a description for your Kubernetes cluster:",
      required: true,
      default: `Panfactum Kubernetes cluster in the ${region} region of the ${environment} environment`,
      validate: (value) => {
        const { error } = CLUSTER_DESCRIPTION.safeParse(value);
        if (error) {
          return error.issues[0]?.message ?? "Invalid cluster description";
        } else {
          return true;
        }
      },
    });
    checkpointer.updateSavedInput("clusterDescription", clusterDescription);
  }

  /***************************************************
   * Deploy the EKS Module
   ***************************************************/
  await deployModule({
    ...options,
    stepId: "eksDeployment",
    stepName: "EKS Setup",
    module: "aws_eks",
    terraguntContents:
      slaTarget === 1 ? awsEksSla1Template : awsEksSla2Template,
    stepNum,
    subStepNum: 1,
    hclUpdates: {
      "inputs.cluster_name": clusterName,
      "inputs.cluster_description": clusterDescription,
    },
  });

  /***************************************************
   * Reset the cluster
   ***************************************************/
  // TODO @jack

  /***************************************************
   * Update the Kubernetes configuration files
   ***************************************************/

  // FIX: @jack
  // await updateKube({
  //   context: input.context,
  //   buildConfig: true,
  //   verbose: input.verbose,
  // });

  //   await buildKubeConfig({
  //     context: input.context
  //   });

  /***************************************************
   * Update the region YAML
   ***************************************************/
  await upsertConfigValues({
    filePath: path.join(clusterPath, "region.yaml"),
    values: {
      kube_config_context: clusterName,
      kube_api_server: "", // FIX: @jack
    },
  });
}
