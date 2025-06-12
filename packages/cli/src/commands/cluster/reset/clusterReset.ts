import { z } from "zod";
import { CLIError } from "@/util/error/error";
import { fileExists } from "@/util/fs/fileExists";
import { execute } from "@/util/subprocess/execute";
import type { PanfactumContext } from "@/util/context/context";
import type { PanfactumTaskWrapper } from "@/util/listr/types";

// This script is intended to remove the default resources that AWS installs in an EKS
// cluster so that we can install our hardened replacements. Unfortunately, this is not
// possible via tf so we create this convenience script to run as a part of the bootstrapping
// guide
export async function clusterReset({
  awsProfile,
  clusterName,
  context,
  awsRegion,
  task,
  clusterPath,
}: {
  awsProfile: string;
  clusterName: string; // FIX: @seth - You are using this for the kubernetes context name which isn't correct, just happens to work currently
  context: PanfactumContext;
  awsRegion: string;
  task: PanfactumTaskWrapper;
  clusterPath: string;
}) {
  // ############################################################
  // ## Step 0: Validation
  // ############################################################

  // FIX: @seth - This isn't validating anything?
  // Needs to check if the user can access the cluster
  // And the error message here doesn't make sense
  const kubeConfigPath = process.env["KUBE_CONFIG_PATH"];
  if (!kubeConfigPath || !fileExists(kubeConfigPath)) {
    throw new CLIError(
      `No kube directory found at ${kubeConfigPath}. Create it with 'pf update-kube' first!`
    );
  }

  // ############################################################
  // ## Step 5: Delete the addons (using the AWS API)
  // ############################################################
  const { stdout: awsAddons } = await execute({
    command: [
      "aws",
      "--profile",
      awsProfile,
      "eks",
      "list-addons",
      "--cluster-name",
      clusterName,
      "--region",
      awsRegion,
      "--output",
      "json",
    ],
    context,
    workingDirectory: clusterPath,
  });
  const addonsToDisable = ["coredns", "kube-proxy", "vpc-cni"];
  const addons = JSON.parse(awsAddons);
  const addonsJson = z
    .object({
      addons: z.array(z.string()),
    })
    .parse(addons);
  for (const addon of addonsJson.addons) {
    if (addonsToDisable.includes(addon)) {
      await execute({
        command: [
          "aws",
          "--profile",
          awsProfile,
          "--region",
          awsRegion,
          "eks",
          "delete-addon",
          "--cluster-name",
          clusterName,
          "--addon-name",
          addon,
          "--no-preserve",
        ],
        context,
        workingDirectory: clusterPath,
      });
      task.output = context.logger.applyColors(`EKS addon disabled: ${addon}`, {
        style: "subtle",
      });
    } else {
      task.output = context.logger.applyColors(`EKS addon not enabled: ${addon}`, {
        style: "subtle",
      });
    }
  }
  // ############################################################
  // ## Step 6: Delete any lingering resources in the cluster itself
  // ############################################################

  const kubectlDelete = async ({
    type,
    name,
  }: {
    type: string;
    name: string;
  }) =>
    execute({
      command: [
        "kubectl",
        "--context",
        clusterName,
        "--namespace",
        "kube-system",
        "delete",
        type,
        name,
        "--ignore-not-found",
      ],
      context,
      workingDirectory: clusterPath,
    });

  await kubectlDelete({ type: "deployment", name: "coredns" });
  await kubectlDelete({ type: "service", name: "kube-dns" });
  await kubectlDelete({ type: "configmap", name: "coredns" });
  await kubectlDelete({ type: "daemonset", name: "aws-node" });
  await kubectlDelete({ type: "configmap", name: "amazon-vpc-cni" });
  await kubectlDelete({ type: "daemonset", name: "kube-proxy" });
  await kubectlDelete({ type: "configmap", name: "kube-proxy" });
  await kubectlDelete({ type: "configmap", name: "kube-proxy-config" });
  await kubectlDelete({ type: "configmap", name: "aws-auth" });
  await execute({
    command: [
      "kubectl",
      "--context",
      clusterName,
      "delete",
      "storageclass",
      "gp2",
      "--ignore-not-found",
    ],
    context,
    workingDirectory: clusterPath,
  });
  // ############################################################
  // ## Step 7: Terminate all nodes so old node-local configuration settings are wiped
  // ############################################################
  const tagKey = `kubernetes.io/cluster/${clusterName}`;
  const tagValue = "owned";
  const { stdout: instanceIds } = await execute({
    command: [
      "aws",
      "--profile",
      awsProfile,
      "--region",
      awsRegion,
      "ec2",
      "describe-instances",
      "--filters",
      `Name=tag:${tagKey},Values=${tagValue}`,
      "Name=instance-state-name,Values=pending,running,stopping,stopped",
      "--query",
      "Reservations[*].Instances[*].InstanceId",
      "--output",
      "text",
    ],
    context,
    workingDirectory: clusterPath,
  });
  if (instanceIds.length !== 0) {
    await execute({
      command: [
        "aws",
        "--profile",
        awsProfile,
        "--region",
        awsRegion,
        "ec2",
        "terminate-instances",
        "--instance-ids",
        ...instanceIds.trim().split(/\s+/),
      ],
      context,
      workingDirectory: clusterPath,
    });
    task.output = context.logger.applyColors(
      "Nodes terminated to reset node-local settings.",
      {
        style: "subtle",
      }
    );
  }
}
