import path from "node:path";
import { confirm } from "@inquirer/prompts";
import pc from "picocolors";
import yaml from "yaml";
import { z } from "zod";
import awsEksSla1Template from "../../templates/aws_eks_sla_1_terragrunt.hcl" with { type: "file" };
import awsEksSla2Template from "../../templates/aws_eks_sla_2_terragrunt.hcl" with { type: "file" };
import { ensureFileExists } from "../../util/ensure-file-exists";
import { replaceHclValue } from "../../util/replace-hcl-value";
import { eksReset } from "../../util/scripts/eks-reset";
import { getRepoVariables } from "../../util/scripts/get-repo-variables";
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
    input.slaLevel === 1 ? awsEksSla1Template : awsEksSla2Template;

  await ensureFileExists({
    context: input.context,
    destinationFile: "./aws_eks/terragrunt.hcl",
    sourceFile: await Bun.file(templateName).text(),
  });

  await replaceHclValue(
    "./aws_eks/terragrunt.hcl",
    "inputs.cluster_name",
    input.clusterName
  );

  await replaceHclValue(
    "./aws_eks/terragrunt.hcl",
    "inputs.cluster_description",
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
    if (input.verbose) {
      input.context.stdout.write(`setupEks kube config: ${config}`);
    }
    const jsonConfig: Record<string, unknown> = yaml.parse(config);
    // If the clusters key is not defined, initialize it as an empty array
    if (jsonConfig["clusters"] === undefined) {
      jsonConfig["clusters"] = [];
    }
    if (!Array.isArray(jsonConfig["clusters"])) {
      throw new Error("Clusters key is not an array");
    }
    if (input.verbose) {
      input.context.stdout.write(
        `setupEks kube config clusters: ${JSON.stringify(jsonConfig["clusters"])}`
      );
    }
    if (
      !jsonConfig["clusters"].some(
        (cluster: { module: string }) =>
          cluster.module ===
          `${terragruntVariables["environment"]}/${terragruntVariables["region"]}/aws_eks`
      )
    ) {
      jsonConfig["clusters"].push({
        module: `${terragruntVariables["environment"]}/${terragruntVariables["region"]}/aws_eks`,
      });
      await Bun.write(kubeConfigPath, yaml.stringify(jsonConfig));
    }
  }

  await updateKube({
    context: input.context,
    buildConfig: true,
    verbose: input.verbose,
  });

  // Setup kubeconfig
  // https://panfactum.com/docs/edge/guides/bootstrapping/kubernetes-cluster#set-up-kubeconfig
  const kubeUserConfigPath = path.join(root, ".kube", "config.user.yaml");
  const kubeUserConfigExists = await Bun.file(kubeUserConfigPath).exists();
  if (!kubeUserConfigExists) {
    await Bun.write(
      kubeUserConfigPath,
      `# A list of all clusters to add to your kubeconfig (clusters must be present in cluster_info file)\n` +
        `clusters:\n` +
        `  - name: "${input.clusterName}"\n` +
        `    aws_profile: ${terragruntVariables["aws_profile"]}`
    );
  } else {
    const kubeUserConfig = await Bun.file(kubeUserConfigPath).text();
    const jsonUserConfig = yaml.parse(kubeUserConfig);
    const jsonUserConfigSchema = z.object({
      clusters: z.array(
        z.object({
          name: z.string(),
          aws_profile: z.string(),
        })
      ),
    });
    const parsedUserConfig = jsonUserConfigSchema.parse(jsonUserConfig);
    if (
      !parsedUserConfig.clusters.some(
        (cluster) => cluster.name === input.clusterName
      )
    ) {
      parsedUserConfig.clusters.push({
        name: input.clusterName,
        aws_profile: terragruntVariables["aws_profile"],
      });
      await Bun.write(kubeUserConfigPath, yaml.stringify(parsedUserConfig));
    }
  }

  await updateKube({
    context: input.context,
    verbose: input.verbose,
  });

  // Reset EKS cluster
  // https://panfactum.com/docs/edge/guides/bootstrapping/kubernetes-cluster#reset-eks-cluster
  await eksReset({
    context: input.context,
  });

  // Prepare to deploy kubernetes modules
  // https://panfactum.com/docs/edge/guides/bootstrapping/kubernetes-cluster#prepare-to-deploy-kubernetes-modules
  const repoVariables = await getRepoVariables({ context: input.context });
  const kubeConfigContext = terragruntVariables["kube_config_context"];
  const kubeApiServer = terragruntVariables["kube_api_server"];
  const regionFile = Bun.file(
    path.join(
      repoVariables.environments_dir,
      terragruntVariables["environment"],
      terragruntVariables["region"],
      "region.yaml"
    )
  );
  const regionFileExists = await regionFile.exists();
  if (!regionFileExists) {
    throw new Error(
      `Region file not found for ${terragruntVariables["environment"]}/${terragruntVariables["region"]}`
    );
  }
  const regionFileText = await regionFile.text();
  const regionFileJson = yaml.parse(regionFileText);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  regionFileJson["kube_config_context"] = kubeConfigContext;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  regionFileJson["kube_api_server"] = kubeApiServer;
  await Bun.write(regionFile, yaml.stringify(regionFileJson));

  // Verify connection to the cluster
  // https://panfactum.com/docs/edge/guides/bootstrapping/kubernetes-cluster#verify-connection
  input.context.stdout.write(
    pc.green(
      "🎉 Congrats! You've successfully deployed a Kubernetes cluster using Panfactum! 🎉\n\n"
    ) +
      pc.blue(
        "Before continuing, please verify the connection to the cluster.\n\n" +
          "Open a new terminal and run:\n" +
          pc.bold(pc.cyan("kubectl cluster-info\n\n")) +
          "You should receive a response similar to the following:\n\n"
      ) +
      "Kubernetes control plane is running at https://99DF0D231CAEFBDA815F2D8F26575FB6.gr7.us-east-2.eks.amazonaws.com\n" +
      "CoreDNS is running at https://99DF0D231CAEFBDA815F2D8F26575FB6.gr7.us-east-2.eks.amazonaws.com/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy\n\n" +
      pc.blue(
        "The Panfactum devShell ships with a TUI called k9s.\n" +
          "To verify what pods are running in the cluster do the following:\n" +
          `1. In a separate terminal window but in this project's root directory run ${pc.bold(pc.cyan("k9s"))}.\n` +
          `2. Type ${pc.bold(pc.cyan("':pods⏎'"))} to list all the pods in the cluster.\n` +
          `3. k9s will filter results by namespace and by default it is set to the default namespace. Press ${pc.bold(pc.cyan("'0'"))} to switch the filter to all namespaces.\n` +
          `4. You should see a minimal list of pods running in the cluster\n` +
          `5. If you don't see any pods, please reach out to us on Discord\n` +
          `6. Type ${pc.bold(pc.cyan("':exit⏎'"))} when ready to exit k9s.\n\n`
      )
  );

  await confirm({
    message: "When you are ready to continue, press enter.",
  });
}
