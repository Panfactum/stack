import { input, search } from "@inquirer/prompts";
import yaml from "yaml";
import { z } from "zod";
import { safeFileExists } from "../safe-file-exists";
import { getRepoVariables } from "./get-repo-variables";
import type { BaseContext } from "clipanion";

// This script is intended to remove the default resources that AWS installs in an EKS
// cluster so that we can install our hardened replacements. Unfortunately, this is not
// possible via tf so we create this convenience script to run as a part of the bootstrapping
// guide
export async function eksReset({
  clusterName,
  commandInvocation,
  context,
  silent = false,
  verbose = false,
}: {
  clusterName?: string;
  commandInvocation: boolean;
  context: BaseContext;
  silent?: boolean;
  verbose?: boolean;
}) {
  // ############################################################
  // ## Step 0: Validation
  // ############################################################
  const repoVariables = await getRepoVariables({ context });
  const kubeDir = repoVariables.kube_dir;
  const userConfigFilePath = `${kubeDir}/config.user.yaml`;
  const clusterInfoFilePath = `${kubeDir}/cluster_info`;

  if (!safeFileExists(userConfigFilePath)) {
    context.stderr.write(
      `Error: No configuration file found at ${userConfigFilePath}. Create it first!`
    );
    throw new Error(
      `Error: No configuration file found at ${userConfigFilePath}. Create it first!`
    );
  }

  if (!safeFileExists(clusterInfoFilePath)) {
    context.stderr.write(
      `Error: No cluster_info file found at ${clusterInfoFilePath}. Create it with 'pf update-kube --build' first!`
    );
    throw new Error(
      `Error: No cluster_info file found at ${clusterInfoFilePath}. Create it with 'pf update-kube --build' first!`
    );
  }

  const kubeConfigPath = process.env["KUBE_CONFIG_PATH"];
  if (!kubeConfigPath || !(await safeFileExists(kubeConfigPath))) {
    context.stderr.write(
      `Error: No kube directory found at ${kubeConfigPath}. Create it with 'pf update-kube' first!`
    );
    throw new Error(
      `Error: No kube directory found at ${kubeConfigPath}. Create it with 'pf update-kube' first!`
    );
  }

  let cluster: string = "";

  if (commandInvocation) {
    // ############################################################
    // ## Step 1: Select the cluster
    // ############################################################
    const kubectlConfig = await Bun.file(kubeConfigPath).text();
    const jsonKubectlConfig = yaml.parse(kubectlConfig);
    const kubectlConfigSchema = z.object({
      clusters: z.array(
        z.object({
          name: z.string(),
          cluster: z.object({
            "certificate-authority-data": z.string().base64(),
            server: z.string(),
          }),
        })
      ),
    });
    const parsedKubectlConfig = kubectlConfigSchema.parse(jsonKubectlConfig);
    const clusterNames = parsedKubectlConfig.clusters.map(
      (cluster) => cluster.name
    );
    cluster = await search({
      message: "Select a Kubernetes cluster:",
      source: async (input) => {
        if (!input) {
          return clusterNames.map((name) => ({ name: name, value: name }));
        }
        return clusterNames
          .filter((name) => name.toLowerCase().includes(input.toLowerCase()))
          .map((name) => ({ name: name, value: name }));
      },
    });

    // ############################################################
    // ## Step 2: Confirmation
    // ############################################################
    context.stderr.write(`You selected: ${cluster}\n`);
    context.stderr.write(
      `WARNING: This will reset core cluster utilities. This should only be done as a part of cluster bootstrapping.\n`
    );
    const confirmCluster = await input({
      message: "Enter name of cluster to confirm:",
    });
    if (confirmCluster !== cluster) {
      context.stderr.write(
        `${confirmCluster} does not match ${cluster}. Exiting.\n`
      );
      throw new Error(`${confirmCluster} does not match ${cluster}. Exiting.`);
    }
  } else {
    if (!clusterName) {
      context.stderr.write(`Error: Cluster name not provided. Exiting.\n`);
      throw new Error(`Error: Cluster name not provided. Exiting.`);
    }
    cluster = clusterName;
  }

  // ############################################################
  // ## Step 3: Select the AWS profile
  // ############################################################
  const userConfigFile = await Bun.file(userConfigFilePath).text();
  const jsonUserConfigFile = yaml.parse(userConfigFile);
  const userConfigFileSchema = z.object({
    clusters: z.array(
      z.object({
        name: z.string(),
        aws_profile: z.string(),
      })
    ),
  });
  const parsedUserConfigFile = userConfigFileSchema.parse(jsonUserConfigFile);
  const awsProfile = parsedUserConfigFile.clusters.find(
    (userConfigCluster) => userConfigCluster.name === cluster
  )?.aws_profile;
  if (!awsProfile) {
    context.stderr.write(
      `Error: AWS profile not found in ${userConfigFilePath}\n`
    );
    throw new Error(`Error: AWS profile not found in ${userConfigFilePath}`);
  }

  // ############################################################
  // ## Step 4: Get the cluster region
  // ############################################################
  const clusterInfoFile = await Bun.file(clusterInfoFilePath).text();
  const clusterInfoLines = clusterInfoFile.split("\n");
  const clusterInfo = clusterInfoLines.find((line) =>
    line.startsWith(`${cluster} `)
  );
  if (!clusterInfo) {
    context.stderr.write(`Error: Cluster not found in ${clusterInfoFilePath}`);
    throw new Error(`Error: Cluster not found in ${clusterInfoFilePath}`);
  }
  const clusterRegion = clusterInfo.split(" ")[1];
  if (!clusterRegion) {
    context.stderr.write(
      `Error: Cluster region not found in ${clusterInfoFilePath}`
    );
    throw new Error(
      `Error: Cluster region not found in ${clusterInfoFilePath}`
    );
  }

  // ############################################################
  // ## Step 5: Delete the addons (using the AWS API)
  // ############################################################
  const awsAddons = Bun.spawnSync([
    "aws",
    "--profile",
    awsProfile,
    "eks",
    "list-addons",
    "--cluster-name",
    cluster,
    "--region",
    clusterRegion,
    "--output",
    "json",
  ]);
  const addonsOutput = awsAddons.stdout.toString();
  if (verbose) {
    context.stderr.write(`AWS addons: ${addonsOutput}\n`);
  }
  const addonsToDisable = ["coredns", "kube-proxy", "vpc-cni"];
  const addons = JSON.parse(addonsOutput);
  const addonsJson = z
    .object({
      addons: z.array(z.string()),
    })
    .parse(addons);
  for (const addon of addonsJson.addons) {
    if (addonsToDisable.includes(addon)) {
      Bun.spawnSync([
        "aws",
        "--profile",
        awsProfile,
        "--region",
        clusterRegion,
        "eks",
        "delete-addon",
        "--cluster-name",
        cluster,
        "--addon-name",
        addon,
        "--no-preserve",
      ]);
      !silent && context.stderr.write(`EKS addon disabled: ${addon}\n`);
    } else {
      !silent && context.stderr.write(`EKS addon not enabled: ${addon}\n`);
    }
  }
  // ############################################################
  // ## Step 6: Delete any lingering resources in the cluster itself
  // ############################################################
  const kubectlDelete = ({ type, name }: { type: string; name: string }) =>
    Bun.spawnSync([
      "kubectl",
      "--context",
      cluster,
      "--namespace",
      "kube-system",
      "delete",
      type,
      name,
      "--ignore-not-found",
    ]);

  kubectlDelete({ type: "deployment", name: "coredns" });
  kubectlDelete({ type: "service", name: "kube-dns" });
  kubectlDelete({ type: "configmap", name: "coredns" });
  kubectlDelete({ type: "daemonset", name: "aws-node" });
  kubectlDelete({ type: "configmap", name: "amazon-vpc-cni" });
  kubectlDelete({ type: "daemonset", name: "kube-proxy" });
  kubectlDelete({ type: "configmap", name: "kube-proxy" });
  kubectlDelete({ type: "configmap", name: "kube-proxy-config" });
  kubectlDelete({ type: "configmap", name: "aws-auth" });
  Bun.spawnSync([
    "kubectl",
    "--context",
    cluster,
    "delete",
    "storageclass",
    "gp2",
    "--ignore-not-found",
  ]);

  // ############################################################
  // ## Step 7: Terminate all nodes so old node-local configuration settings are wiped
  // ############################################################
  const tagKey = `kubernetes.io/cluster/${cluster}`;
  const tagValue = "owned";
  const instanceIds = Bun.spawnSync([
    "aws",
    "--profile",
    awsProfile,
    "--region",
    clusterRegion,
    "ec2",
    "describe-instances",
    "--filters",
    `Name=tag:${tagKey},Values=${tagValue}`,
    "Name=instance-state-name,Values=pending,running,stopping,stopped",
    "--query",
    "Reservations[*].Instances[*].InstanceId",
    "--output",
    "text",
  ]);
  const instanceIdsOutput = instanceIds.stdout.toString();
  const instanceIdsArray = instanceIdsOutput.split("\n");
  if (instanceIdsArray.length === 0) {
    !silent && context.stderr.write("No nodes to terminate");
  } else {
    Bun.spawnSync([
      "aws",
      "--profile",
      awsProfile,
      "--region",
      clusterRegion,
      "ec2",
      "terminate-instances",
      "--instance-ids",
      instanceIdsArray.join(","),
    ]);
    !silent &&
      context.stderr.write(`Nodes terminated to reset node-local settings.\n`);
  }
}
