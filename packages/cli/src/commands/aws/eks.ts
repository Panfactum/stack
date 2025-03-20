import path from "node:path";
import yaml from "yaml";
import { ensureFileExists } from "../../util/ensure-file-exists";
import { replaceHclValue } from "../../util/replace-hcl-value";
import { getTerragruntVariables } from "../../util/scripts/get-terragrunt-variables";
import { getRoot } from "../../util/scripts/helpers/get-root";
import { tfInit } from "../../util/scripts/tf-init";
import { updateKube } from "../../util/scripts/update-kube";
import { apply } from "../terragrunt/apply";
import type { BaseContext } from "clipanion";

interface EksSetupInput {
  context: BaseContext;
  verbose?: boolean;
  clusterName: string;
  clusterDescription: string;
  slaLevel: 1 | 2 | 3;
}

export async function setupEks(input: EksSetupInput) {
  const templateName =
    input.slaLevel === 1
      ? "aws_eks_sla_1_terragrunt.hcl"
      : "aws_eks_sla_2_terragrunt.hcl";

  await ensureFileExists({
    context: input.context,
    destinationFile: "./aws_eks/terragrunt.hcl",
    sourceFile: await Bun.file(
      import.meta.dir + `/templates/${templateName}`
    ).text(),
  });

  await replaceHclValue(
    "./aws_eks/terragrunt.hcl",
    "cluster_name",
    input.clusterName
  );

  await replaceHclValue(
    "./aws_eks/terragrunt.hcl",
    "cluster_description",
    input.clusterDescription
  );

  tfInit({
    context: input.context,
    verbose: input.verbose,
    workingDirectory: "./aws_eks",
  });

  apply({
    context: input.context,
    verbose: input.verbose,
    workingDirectory: "./aws_eks",
  });

  // Setup cluster_info metadata and CA certs
  // https://panfactum.com/docs/edge/guides/bootstrapping/kubernetes-cluster#set-up-cluster_info-metadata-and-ca-certs
  const terragruntVariables = await getTerragruntVariables({
    context: input.context,
  });
  if (typeof terragruntVariables["environment"] !== "string") {
    throw new Error("Environment not correctly set for Terragrunt");
  }
  if (typeof terragruntVariables["region"] !== "string") {
    throw new Error("Region not correctly set for Terragrunt");
  }
  const { root } = await getRoot();
  const kubeConfigPath = path.join(root, ".kube", "config.yaml");
  const configExists = await Bun.file(kubeConfigPath).exists();
  if (!configExists) {
    const config = await Bun.file(kubeConfigPath).text();
    if (
      !config.includes(
        `"${terragruntVariables["environment"]}/${terragruntVariables["region"]}/aws_eks"`
      )
    ) {
      await Bun.write(
        kubeConfigPath,
        `# A list of all clusters deployed via aws_eks\nclusters:\n  - module: "${terragruntVariables["environment"]}/${terragruntVariables["region"]}/aws_eks"`
      );
    }
  } else {
    // If the config.yaml file already exists, we need to verify if it contains the cluster and if not, add it
    const config = await Bun.file(kubeConfigPath).text();
    const jsonConfig: Record<string, unknown> = yaml.parse(config);
    // If the clusters key is not defined, initialize it as an empty array
    if (jsonConfig["clusters"] === undefined) {
      jsonConfig["clusters"] = [];
    }
    if (!Array.isArray(jsonConfig["clusters"])) {
      throw new Error("Clusters key is not an array");
    }
    if (
      !jsonConfig["clusters"].includes(
        `{module: "${terragruntVariables["environment"]}/${terragruntVariables["region"]}/aws_eks"}`
      )
    ) {
      jsonConfig["clusters"].push(
        `{module: "${terragruntVariables["environment"]}/${terragruntVariables["region"]}/aws_eks"}`
      );
      await Bun.write(kubeConfigPath, yaml.stringify(jsonConfig));
    }
  }

  await updateKube({
    context: input.context,
    buildConfig: true,
  });

  // Setup kubeconfig
  //https://panfactum.com/docs/edge/guides/bootstrapping/kubernetes-cluster#set-up-kubeconfig

  // verify connection to the cluster
  // https://panfactum.com/docs/edge/guides/bootstrapping/kubernetes-cluster#verify-connection

  // Reset EKS cluster
  // https://panfactum.com/docs/edge/guides/bootstrapping/kubernetes-cluster#reset-eks-cluster

  // Prepare to deploy kubernetes modules
  // https://panfactum.com/docs/edge/guides/bootstrapping/kubernetes-cluster#prepare-to-deploy-kubernetes-modules
}
