import { join } from "path";
import pc from "picocolors";
import { z } from "zod";
import kubeVaultTemplate from "@/templates/kube_vault_terragrunt.hcl" with { type: "file" };
import { CLIError } from "@/util/error/error";
import { parseErrorHandler } from "@/util/error/parseErrorHandler";
import { sopsUpsert } from "@/util/sops/sopsUpsert";
import { execute } from "@/util/subprocess/execute";
import { replaceHCLValue } from "@/util/terragrunt/replaceHCLValue";
import { deployModule } from "./deployModule";
import { informStepComplete, informStepStart } from "./messages";
import type { InstallClusterStepOptions } from "./common";

const RECOVER_KEYS_SCHEMA = z.object({
  unseal_keys_b64: z.array(z.string().base64()),
  unseal_keys_hex: z.array(z.string()),
  unseal_shares: z.number(),
  unseal_threshold: z.number(),
  recovery_keys_b64: z.array(z.string().base64()),
  recovery_keys_hex: z.array(z.string()),
  recovery_keys_shares: z.number(),
  recovery_keys_threshold: z.number(),
  root_token: z.string(),
});

const UNSEAL_OUTPUT_SCHEMA = z.object({
  type: z.string(),
  initialized: z.boolean(),
  sealed: z.boolean(),
  t: z.number(),
  n: z.number(),
  progress: z.number(),
  nonce: z.string(),
  version: z.string(),
  build_date: z.string(),
  migration: z.boolean(),
  cluster_name: z.string(),
  cluster_id: z.string(),
  recovery_seal: z.boolean(),
  storage_type: z.string(),
  ha_enabled: z.boolean(),
  is_self: z.boolean(),
  active_time: z.string(),
  leader_address: z.string(),
  leader_cluster_address: z.string(),
  raft_committed_index: z.number(),
  raft_applied_index: z.number(),
});

export async function setupVault(options: InstallClusterStepOptions) {
  const { checkpointer, clusterPath, context, kubeDomain, stepNum } = options;

  const modulePath = join(clusterPath, "kube_vault");
  const hclFile = join(modulePath, "terragrunt.hcl");
  const secretsPath = join(modulePath, "secrets.yaml");

  /***************************************************
   * Deploy the Vault Module
   ***************************************************/
  const vaultDomain = `vault.${kubeDomain}`;
  await deployModule({
    ...options,
    stepId: "vaultDeployment",
    stepName: "Vault Setup",
    moduleDirectory: "kube_vault",
    terraguntContents: kubeVaultTemplate,
    stepNum,
    subStepNum: 1,
    hclUpdates: {
      "inputs.vault_domain": vaultDomain,
    },
  });

  checkpointer.updateSavedInput("vaultDomain", vaultDomain);

  /***************************************************
   * Wait for all Vault pods to start running
   ***************************************************/
  const vaultPodsRunning = context.logger.progressMessage(
    "Checking status of the Vault pods",
    { interval: 10000 }
  );
  const workingDirectory = process.cwd();
  const command = ["kubectl", "get", "pods", "--all-namespaces", "-o", "json"];
  await execute({
    command,
    context,
    workingDirectory,
    errorMessage: "Vault pods failed to start",
    retries: 20,
    isSuccess: (result) => {
      try {
        const pods = JSON.parse(result.stdout);
        const podsSchema = z.object({
          items: z.array(
            z.object({
              metadata: z.object({
                name: z.string(),
                namespace: z.string(),
              }),
              status: z.object({
                phase: z.string(),
              }),
            })
          ),
        });
        const parsedPods = podsSchema.parse(pods);
        return parsedPods.items.every((pod) => pod.status.phase === "Running");
      } catch {
        context.logger.log("Failed to parse Vault pods", {
          level: "debug",
          style: "warning",
        });
        return false;
      }
    },
  });
  vaultPodsRunning();

  /***************************************************
   * Initialize Vault
   ***************************************************/
  const subStepLabel = "Vault Operator Init";
  const subStepNumber = 2;
  const vaultOperatorInitStepId = "vaultOperatorInit";
  if (await checkpointer.isStepComplete(vaultOperatorInitStepId)) {
    informStepComplete(context, subStepLabel, stepNum, subStepNumber);
  } else {
    informStepStart(context, subStepLabel, stepNum, subStepNumber);

    const vaultOperatorInitCommand = [
      "kubectl",
      "exec",
      "-i",
      "vault-0",
      "--namespace=vault",
      "--",
      "vault",
      "operator",
      "init",
      "-recovery-shares=1",
      "-recovery-threshold=1",
      "-format=json",
    ];
    let recoveryKeys: z.infer<typeof RECOVER_KEYS_SCHEMA>;
    try {
      const { stdout } = await execute({
        command: vaultOperatorInitCommand,
        context,
        workingDirectory,
        errorMessage: "Failed to initialize vault",
      });

      context.logger.log("vault operator init: " + stdout, { level: "debug" });

      const data = JSON.parse(stdout.trim());
      recoveryKeys = RECOVER_KEYS_SCHEMA.parse(data);
    } catch (error) {
      parseErrorHandler({
        error,
        zodErrorMessage: "Failed to parse vault operator init",
        genericErrorMessage: "Unable to parse outputs from vault operator init",
        command: vaultOperatorInitCommand.join(" "),
      });
    }

    let vaultUnsealCommand: string[] = [];
    try {
      let sealedStatus = true;
      for (const key of recoveryKeys!.recovery_keys_hex) {
        vaultUnsealCommand = [
          "kubectl",
          "exec",
          "-i",
          "vault-0",
          "--namespace=vault",
          "--",
          "vault",
          "operator",
          "unseal",
          "-format=json",
          key,
        ];
        const { stdout } = await execute({
          command: vaultUnsealCommand,
          context,
          workingDirectory,
          errorMessage: "Failed to unseal Vault",
        });

        const statusData = JSON.parse(stdout.trim());
        const unsealOutput = UNSEAL_OUTPUT_SCHEMA.parse(statusData);
        sealedStatus = unsealOutput.sealed;
        if (!sealedStatus) {
          context.logger.log("Vault successfully unsealed", {
            leadingNewlines: 1,
            style: "success",
          });
          break;
        }
      }

      if (sealedStatus) {
        context.logger.log(
          "Failed to unseal Vault after applying all recovery keys",
          { level: "error" }
        );
        throw new CLIError(
          "Failed to unseal Vault after applying all recovery keys"
        );
      }

      await replaceHCLValue(hclFile, "inputs.wait", true);

      checkpointer.updateSavedInput("vaultRootToken", recoveryKeys!.root_token);
      checkpointer.updateSavedInput("vaultAddress", "http://127.0.0.1:8200");

      await sopsUpsert({
        values: {
          root_token: recoveryKeys!.root_token,
          recovery_keys: recoveryKeys!.recovery_keys_hex.map((key) => key),
        },
        context,
        filePath: secretsPath,
      });

      context.logger.log(
        [
          pc.bold("NOTE: "),
          "The recovery keys and root token have been encrypted and saved in the kube_vault folder.",
          "The root token allows root access to the vault instance.",
          `These keys ${pc.bold("SHOULD NOT")} be left here.`,
          "Decide how your organization recommends superusers store these keys.",
          `This should ${pc.bold("not")} be in a location that is accessible by all superusers (e.g. a company password vault).`,
        ],
        {
          trailingNewlines: 1,
        }
      );

      /***************************************************
       * Mark Finished
       ***************************************************/
      await checkpointer.setStepComplete(vaultOperatorInitStepId);
    } catch (error) {
      parseErrorHandler({
        error,
        zodErrorMessage: "Failed to unseal Vault",
        genericErrorMessage: "Failed to unseal Vault",
        command: vaultUnsealCommand.join(" "),
      });
    }
  }
}
