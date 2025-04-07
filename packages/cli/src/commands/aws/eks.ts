import path from "node:path";
import yaml from "yaml";
import { z } from "zod";
import awsEksSla1Template from "../../templates/aws_eks_sla_1_terragrunt.hcl" with { type: "file" };
import awsEksSla2Template from "../../templates/aws_eks_sla_2_terragrunt.hcl" with { type: "file" };
import { ensureFileExists } from "../../util/ensure-file-exists";
import { initAndApplyModule } from "../../util/init-and-apply-module";
import { replaceHclValue } from "../../util/replace-hcl-value";
import { safeFileExists } from "../../util/safe-file-exists";
import { eksReset } from "../../util/scripts/eks-reset";
import { getRepoVariables } from "../../util/scripts/get-repo-variables";
import { getTerragruntVariables } from "../../util/scripts/get-terragrunt-variables";
import { getRoot } from "../../util/scripts/helpers/get-root";
import { updateKube } from "../../util/scripts/update-kube";
import { writeErrorToDebugFile } from "../../util/write-error-to-debug-file";
import type { BaseContext } from "clipanion";

interface EksSetupInput {
  context: BaseContext;
  verbose?: boolean;
  clusterName: string;
  clusterDescription: string;
  slaLevel: 1 | 2 | 3;
}

// @ts-ignore - ignoring "Not all code paths return a value" which is fine as only if the user does not confirm readiness to continue, we return an explicit code of 0
// eslint-disable-next-line sonarjs/cognitive-complexity
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

  await initAndApplyModule({
    context: input.context,
    moduleName: "AWS EKS",
    modulePath: "./aws_eks",
    verbose: input.verbose,
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
      writeErrorToDebugFile({
        context: input.context,
        error: `Clusters key is not an array: ${JSON.stringify(jsonConfig["clusters"])}`,
      });
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
    silent: true,
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
    silent: true,
    verbose: input.verbose,
  });

  // Reset EKS cluster
  // https://panfactum.com/docs/edge/guides/bootstrapping/kubernetes-cluster#reset-eks-cluster
  await eksReset({
    clusterName: input.clusterName,
    commandInvocation: false,
    context: input.context,
    silent: true,
    verbose: input.verbose,
  });

  // Prepare to deploy kubernetes modules
  // https://panfactum.com/docs/edge/guides/bootstrapping/kubernetes-cluster#prepare-to-deploy-kubernetes-modules
  const repoVariables = await getRepoVariables({ context: input.context });
  const clusterInfoFilePath = `${repoVariables.kube_dir}/cluster_info`;
  const clusterInfoFile = await Bun.file(clusterInfoFilePath).text();
  const clusterInfoLines = clusterInfoFile.split("\n");
  const clusterInfo = clusterInfoLines.find((line) =>
    line.startsWith(`${input.clusterName} `)
  );
  if (!clusterInfo) {
    input.context.stderr.write(
      `Error: Cluster not found in ${clusterInfoFilePath}`
    );
    throw new Error(`Error: Cluster not found in ${clusterInfoFilePath}`);
  }
  const [kubeConfigContext, , kubeApiServer] = clusterInfo.split(" ");
  if (!kubeConfigContext) {
    input.context.stderr.write(
      `Error: kube_config_context not found in ${clusterInfoFilePath}`
    );
    throw new Error(
      `Error: kube_config_context not found in ${clusterInfoFilePath}`
    );
  }
  if (!kubeApiServer) {
    input.context.stderr.write(
      `Error: kube_api_server not found in ${clusterInfoFilePath}`
    );
    throw new Error(
      `Error: kube_api_server not found in ${clusterInfoFilePath}`
    );
  }

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
  regionFileJson["kube_config_context"] = kubeConfigContext;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  regionFileJson["kube_api_server"] = kubeApiServer;
  await Bun.write(regionFile, yaml.stringify(regionFileJson));
}
