// This module handles resetting EKS clusters to remove default AWS resources
// It prepares clusters for Panfactum's hardened component installation

import { z } from "zod";
import { CLIError, CLISubprocessError } from "@/util/error/error";
import { fileExists } from "@/util/fs/fileExists";
import { parseJson } from "@/util/json/parseJson";
import type { PanfactumContext } from "@/util/context/context";
import type { PanfactumTaskWrapper } from "@/util/listr/types";

/**
 * Interface for cluster reset parameters
 */
interface IClusterResetInput {
  /** AWS profile to use for API calls */
  awsProfile: string;
  /** Name of the EKS cluster to reset */
  clusterName: string; // FIX: @seth - You are using this for the kubernetes context name which isn't correct, just happens to work currently
  /** Panfactum context for logging */
  context: PanfactumContext;
  /** AWS region where the cluster is deployed */
  awsRegion: string;
  /** Listr task for progress updates */
  task: PanfactumTaskWrapper;
  /** File system path to cluster configuration */
  clusterPath: string;
  /**
   * When true, deletes resources even if they carry the `panfactum.com/workload` label.
   * Defaults to false to protect Panfactum-managed resources during resumed installations.
   */
  force?: boolean;
}

/**
 * Resets an EKS cluster by removing default AWS resources
 * 
 * @remarks
 * This function removes the default resources that AWS automatically
 * installs in EKS clusters, preparing them for Panfactum's hardened
 * replacements. This cleanup is necessary because:
 * 
 * - AWS installs default addons that conflict with Panfactum components
 * - Default configurations don't meet security hardening requirements
 * - Some resources can't be removed via Terraform
 * 
 * The reset process includes:
 * 1. **Validation**: Ensures kubeconfig exists
 * 2. **Addon Removal**: Deletes AWS EKS addons (coredns, kube-proxy, vpc-cni)
 * 3. **Resource Cleanup**: Removes Kubernetes resources in kube-system
 * 4. **Node Termination**: Terminates all nodes to clear node-local state
 * 
 * This function is idempotent and safe to run multiple times.
 * Resources that don't exist are ignored.
 *
 * Resources that carry the `panfactum.com/workload` label are skipped unless
 * `force` is set to `true`. This prevents Panfactum-managed resources from
 * being accidentally removed during resumed installations.
 *
 * @param input - Configuration for the cluster reset operation
 * 
 * @example
 * ```typescript
 * await clusterReset({
 *   awsProfile: 'production',
 *   clusterName: 'prod-cluster',
 *   context: panfactumContext,
 *   awsRegion: 'us-east-1',
 *   task: currentTask,
 *   clusterPath: '/path/to/cluster/config'
 * });
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when kubeconfig path is not found or invalid
 * 
 * @see {@link execute} - For running AWS CLI and kubectl commands
 * @see {@link parseJson} - For parsing AWS CLI JSON output
 */
export async function clusterReset(input: IClusterResetInput) {
  const {
    awsProfile,
    clusterName,
    context,
    awsRegion,
    task,
    clusterPath,
    force = false,
  } = input;
  // ############################################################
  // ## Step 0: Validation
  // ############################################################

  // FIX: @seth - This isn't validating anything?
  // Needs to check if the user can access the cluster
  // And the error message here doesn't make sense
  const kubeConfigPath = process.env["KUBE_CONFIG_PATH"];
  if (!kubeConfigPath || !(await fileExists({ filePath: kubeConfigPath }))) {
    throw new CLIError(
      `No kube directory found at ${kubeConfigPath}. Create it with 'pf update-kube' first!`
    );
  }

  // ############################################################
  // ## Step 5: Delete the addons (using the AWS API)
  // ############################################################
  const listAddonsCommand = [
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
  ];
  const listAddonsResult = await context.subprocessManager.execute({
    command: listAddonsCommand,
    workingDirectory: clusterPath,
  }).exited;

  if (listAddonsResult.exitCode !== 0) {
    throw new CLISubprocessError(
      `Failed to list EKS addons for cluster ${clusterName}`,
      {
        command: listAddonsCommand.join(" "),
        subprocessLogs: listAddonsResult.output,
        workingDirectory: clusterPath,
      }
    );
  }

  const addonsToDisable = ["coredns", "kube-proxy", "vpc-cni"];
  const addonsSchema = z.object({
    addons: z.array(z.string()),
  });
  const addonsJson = parseJson(addonsSchema, listAddonsResult.stdout);
  for (const addon of addonsJson.addons) {
    if (addonsToDisable.includes(addon)) {
      const deleteAddonCommand = [
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
      ];
      const deleteAddonResult = await context.subprocessManager.execute({
        command: deleteAddonCommand,
        workingDirectory: clusterPath,
      }).exited;

      if (deleteAddonResult.exitCode !== 0) {
        throw new CLISubprocessError(
          `Failed to delete EKS addon ${addon}`,
          {
            command: deleteAddonCommand.join(" "),
            subprocessLogs: deleteAddonResult.output,
            workingDirectory: clusterPath,
          }
        );
      }

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

  /**
   * Helper to delete Kubernetes resources
   *
   * @remarks
   * Deletes resources in the kube-system namespace, ignoring resources that
   * don't exist. Resources that carry the `panfactum.com/workload` label are
   * skipped unless `force` is `true`.
   *
   * @internal
   */
  // FIX: @seth - Use Kubernetes SDK
  const kubectlDelete = async ({
    type,
    name,
  }: {
    type: string;
    name: string;
  }) => {
    if (!force) {
      const getCommand = [
        "kubectl",
        "--context",
        clusterName,
        "--namespace",
        "kube-system",
        "get",
        type,
        name,
        "-o",
        "json",
        "--ignore-not-found",
      ];
      const getResult = await context.subprocessManager.execute({
        command: getCommand,
        workingDirectory: clusterPath,
      }).exited;

      if (getResult.exitCode !== 0) {
        throw new CLISubprocessError(
          `Failed to get ${type}/${name} in kube-system namespace`,
          {
            command: getCommand.join(" "),
            subprocessLogs: getResult.output,
            workingDirectory: clusterPath,
          }
        );
      }

      if (getResult.stdout.trim().length > 0) {
        const resourceSchema = z.object({
          metadata: z.object({
            labels: z.record(z.string()).optional(),
          }),
        });
        const resource = parseJson(resourceSchema, getResult.stdout);
        if (resource.metadata.labels?.["panfactum.com/workload"] !== undefined) {
          task.output = context.logger.applyColors(
            `Skipped ${type}/${name}: has panfactum.com/workload label (use --force to override)`,
            { style: "subtle" }
          );
          return;
        }
      }
    }

    const command = [
      "kubectl",
      "--context",
      clusterName,
      "--namespace",
      "kube-system",
      "delete",
      type,
      name,
      "--ignore-not-found",
    ];
    const result = await context.subprocessManager.execute({
      command,
      workingDirectory: clusterPath,
    }).exited;

    if (result.exitCode !== 0) {
      throw new CLISubprocessError(
        `Failed to delete ${type}/${name} in kube-system namespace`,
        {
          command: command.join(" "),
          subprocessLogs: result.output,
          workingDirectory: clusterPath,
        }
      );
    }
  };

  await kubectlDelete({ type: "deployment", name: "coredns" });
  await kubectlDelete({ type: "service", name: "kube-dns" });
  await kubectlDelete({ type: "configmap", name: "coredns" });
  await kubectlDelete({ type: "daemonset", name: "aws-node" });
  await kubectlDelete({ type: "configmap", name: "amazon-vpc-cni" });
  await kubectlDelete({ type: "daemonset", name: "kube-proxy" });
  await kubectlDelete({ type: "configmap", name: "kube-proxy" });
  await kubectlDelete({ type: "configmap", name: "kube-proxy-config" });
  await kubectlDelete({ type: "configmap", name: "aws-auth" });

  const deleteStorageClassCommand = [
    "kubectl",
    "--context",
    clusterName,
    "delete",
    "storageclass",
    "gp2",
    "--ignore-not-found",
  ];
  const deleteStorageClassResult = await context.subprocessManager.execute({
    command: deleteStorageClassCommand,
    workingDirectory: clusterPath,
  }).exited;

  if (deleteStorageClassResult.exitCode !== 0) {
    throw new CLISubprocessError(
      "Failed to delete gp2 storage class",
      {
        command: deleteStorageClassCommand.join(" "),
        subprocessLogs: deleteStorageClassResult.output,
        workingDirectory: clusterPath,
      }
    );
  }
  // ############################################################
  // ## Step 7: Terminate all nodes so old node-local configuration settings are wiped
  // ############################################################
  const tagKey = `kubernetes.io/cluster/${clusterName}`;
  const tagValue = "owned";
  const describeInstancesCommand = [
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
  ];
  const describeInstancesResult = await context.subprocessManager.execute({
    command: describeInstancesCommand,
    workingDirectory: clusterPath,
  }).exited;

  if (describeInstancesResult.exitCode !== 0) {
    throw new CLISubprocessError(
      `Failed to describe EC2 instances for cluster ${clusterName}`,
      {
        command: describeInstancesCommand.join(" "),
        subprocessLogs: describeInstancesResult.output,
        workingDirectory: clusterPath,
      }
    );
  }

  const instanceIds = describeInstancesResult.stdout;
  if (instanceIds.trim().length !== 0) {
    const terminateInstancesCommand = [
      "aws",
      "--profile",
      awsProfile,
      "--region",
      awsRegion,
      "ec2",
      "terminate-instances",
      "--instance-ids",
      ...instanceIds.trim().split(/\s+/),
    ];
    const terminateInstancesResult = await context.subprocessManager.execute({
      command: terminateInstancesCommand,
      workingDirectory: clusterPath,
    }).exited;

    if (terminateInstancesResult.exitCode !== 0) {
      throw new CLISubprocessError(
        "Failed to terminate EC2 instances",
        {
          command: terminateInstancesCommand.join(" "),
          subprocessLogs: terminateInstancesResult.output,
          workingDirectory: clusterPath,
        }
      );
    }

    task.output = context.logger.applyColors(
      "Nodes terminated to reset node-local settings.",
      {
        style: "subtle",
      }
    );
  }
}
