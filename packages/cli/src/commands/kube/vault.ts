import { $ } from "bun";
import pc from "picocolors";
import { z } from "zod";
import kubeVaultTerragruntHcl from "../../templates/kube_vault_terragrunt.hcl" with { type: "file" };
import vaultCoreResourcesTerragruntHcl from "../../templates/vault_core_resources_terragrunt.hcl" with { type: "file" };
import { ensureFileExists } from "../../util/ensure-file-exists";
import { progressMessage } from "../../util/progress-message";
import { replaceHclValue } from "../../util/replace-hcl-value";
import { safeFileExists } from "../../util/safe-file-exists";
import { getRepoVariables } from "../../util/scripts/get-repo-variables";
import { tfInit } from "../../util/scripts/tf-init";
import { sopsEncrypt } from "../../util/sops-encrypt";
import { startBackgroundProcess } from "../../util/start-background-process";
import { writeErrorToDebugFile } from "../../util/write-error-to-debug-file";
import { apply } from "../terragrunt/apply";
import type { BaseContext } from "clipanion";

export const setupVault = async ({
  context,
  vaultDomain,
  verbose = false,
}: {
  context: BaseContext;
  vaultDomain: string;
  verbose?: boolean;
  // eslint-disable-next-line sonarjs/cognitive-complexity
}) => {
  // https://panfactum.com/docs/edge/guides/bootstrapping/vault#deploy-vault
  context.stdout.write("7.a. Setting up Vault\n");

  await ensureFileExists({
    context,
    destinationFile: "./kube_vault/terragrunt.hcl",
    sourceFile: await Bun.file(kubeVaultTerragruntHcl).text(),
  });

  await replaceHclValue(
    "./kube_vault/terragrunt.hcl",
    "inputs.vault_domain",
    vaultDomain
  );

  tfInit({
    context,
    verbose,
    workingDirectory: "./kube_vault",
  });

  try {
    apply({
      context,
      suppressErrors: true,
      verbose,
      workingDirectory: "./kube_vault",
    });
  } catch {
    // It's okay if this fails as we must manually initialize the vault on first use
    // We'll ignore this and do more checks below to see if the vault was instantiated successfully
  }

  let vaultPodNames: string[] = [];

  // We'll check to see if the pods are running
  // If they are, we'll assume that the vault was instantiated successfully and we can proceed
  let allPodsRunning = false;
  const vaultStatusProgress = progressMessage({
    context,
    message: "Checking status of Vault pods",
    interval: 10000,
  });
  let count = 0;
  while (!allPodsRunning) {
    // Wait for 10 seconds
    await new Promise((resolve) => globalThis.setTimeout(resolve, 10000));
    // Only wait for 5 minutes
    if (count > 30) {
      throw new Error("Vault pods failed to start");
    }

    const result =
      await $`kubectl get pods --all-namespaces -o json | jq '[.items[] | select(.metadata.name | startswith("vault")) | {name: .metadata.name, namespace: .metadata.namespace, status: .status.phase}]'`.text();

    if (verbose) {
      context.stdout.write("getInstanceId STDOUT: " + result + "\n");
      context.stderr.write("getInstanceId STDERR: " + result + "\n");
    }

    const pods = JSON.parse(result.trim());
    const podsSchema = z.array(
      z.object({
        name: z.string(),
        namespace: z.string(),
        status: z.string(),
      })
    );
    const parsedPods = podsSchema.parse(pods);

    allPodsRunning = parsedPods.every((pod) => pod.status === "Running");
    if (allPodsRunning) {
      vaultPodNames = parsedPods.map((pod) => pod.name);
    }
    count++;
  }

  globalThis.clearInterval(vaultStatusProgress);
  context.stdout.write("\n");

  if (verbose) {
    context.stdout.write("Vault pods: " + vaultPodNames.join(", ") + "\n");
  }

  // https://panfactum.com/docs/edge/guides/bootstrapping/vault#initialize-vault
  context.stdout.write("7.b. Initializing Vault\n");

  const recoveryKeysSchema = z.object({
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

  let recoveryKeys: z.infer<typeof recoveryKeysSchema>;
  try {
    // Run the vault operator init command in the pod
    let result = "";
    try {
      result =
        await $`kubectl exec -i ${vaultPodNames[0]} --namespace=vault -- vault operator init -recovery-shares=1 -recovery-threshold=1 -format=json`.text();
    } catch (error) {
      context.stderr.write(
        pc.red("Failed to initialize vault.\n" + JSON.stringify(error, null, 2))
      );
    }

    if (verbose) {
      context.stdout.write("vault operator init STDOUT: " + result + "\n");
      context.stderr.write("vault operator init STDERR: " + result + "\n");
    }

    const data = JSON.parse(result.trim());
    recoveryKeys = recoveryKeysSchema.parse(data);
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? `Error running vault operator init: ${error.message}`
        : "Error running vault operator init";
    context.stderr.write(`${pc.red(errorMessage)}\n`);
    writeErrorToDebugFile({
      context,
      error,
    });
    throw new Error("Failed to initialize vault");
  }

  let sealedStatus = true;
  // Unseal Vault using recovery keys
  try {
    for (const key of recoveryKeys.recovery_keys_hex) {
      const statusResult =
        await $`kubectl exec -i ${vaultPodNames[0]} --namespace=vault -- vault operator unseal -format=json ${key}`.text();
      const statusData = JSON.parse(statusResult.trim());
      const unsealOutputSchema = z.object({
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
      const unsealOutput = unsealOutputSchema.parse(statusData);

      sealedStatus = unsealOutput.sealed;
      if (!sealedStatus) {
        context.stdout.write(pc.green("\nVault successfully unsealed\n"));
        break;
      }
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? `Error unsealing Vault: ${error.message}`
        : "Error unsealing Vault";
    context.stderr.write(`${pc.red(errorMessage)}\n`);
    writeErrorToDebugFile({
      context,
      error,
    });
    throw new Error("Failed to unseal Vault");
  }

  if (sealedStatus) {
    context.stderr.write(
      pc.red("Failed to unseal Vault after applying all recovery keys\n")
    );
    throw new Error("Failed to unseal Vault after applying all recovery keys");
  }

  // Set environment variable programmatically
  process.env["VAULT_ADDR"] = "http://127.0.0.1:8200";
  process.env["VAULT_TOKEN"] = recoveryKeys.root_token;

  await replaceHclValue("./kube_vault/terragrunt.hcl", "inputs.wait", true);
  // Check to make sure all the vault pods are running and healthy

  context.stdout.write("\n7.c. 🔒 Encrypting secrets\n\n");

  await sopsEncrypt({
    context,
    filePath: "./kube_vault/secrets.yaml",
    fileContents: `root_token: ${recoveryKeys.root_token}\nrecovery_keys:\n${recoveryKeys.recovery_keys_hex.map((key) => `  - ${key}`).join("\n")}`,
    errorMessage: "Failed to encrypt Vault secrets",
    tempFilePath: "./.tmp-vault-secrets.yaml",
  });

  context.stdout.write(
    pc.blue(
      pc.bold("NOTE: ") +
        "The recovery keys and root token have been encrypted and saved in the kube_vault folder.\n" +
        "The root token allows root access to the vault instance.\n" +
        "The recovery keys allow creating new root tokens.\n" +
        "These keys " +
        pc.bold("SHOULD NOT ") +
        "be left here.\n" +
        "Decide how your organization recommends superusers store these keys.\n" +
        "This should " +
        pc.bold("not ") +
        "be in a location that is accessible by all superusers (e.g. a company password vault).\n\n"
    )
  );

  // https://panfactum.com/docs/edge/guides/bootstrapping/vault#configure-vault
  context.stdout.write("7.d. Configuring Vault\n");

  const repoVariables = await getRepoVariables({
    context,
  });

  const repoRoot = repoVariables.repo_root;

  // Add VAULT_ADDR and VAULT_TOKEN to .env file
  const envFilePath = `${repoRoot}/.env`;
  let envContent = "";

  // Check if .env file exists
  if (await safeFileExists(envFilePath)) {
    // Read existing content
    envContent = await Bun.file(envFilePath).text();

    // Replace or add VAULT_ADDR and VAULT_TOKEN
    const envLines = envContent.split("\n");
    const updatedLines = [];

    let vaultAddrFound = false;
    let vaultTokenFound = false;

    for (const line of envLines) {
      if (line.startsWith("VAULT_ADDR=")) {
        updatedLines.push("VAULT_ADDR=http://127.0.0.1:8200");
        vaultAddrFound = true;
      } else if (line.startsWith("VAULT_TOKEN=")) {
        updatedLines.push(`VAULT_TOKEN=${recoveryKeys.root_token}`);
        vaultTokenFound = true;
      } else {
        updatedLines.push(line);
      }
    }

    if (!vaultAddrFound) {
      updatedLines.push("VAULT_ADDR=http://127.0.0.1:8200");
    }

    if (!vaultTokenFound) {
      updatedLines.push(`VAULT_TOKEN=${recoveryKeys.root_token}`);
    }

    envContent = updatedLines.join("\n");
  } else {
    // Create new .env file with VAULT_ADDR and VAULT_TOKEN
    envContent = `VAULT_ADDR=http://127.0.0.1:8200\nVAULT_TOKEN=${recoveryKeys.root_token}`;
  }

  // Write to .env file
  await Bun.write(envFilePath, envContent);

  // https://panfactum.com/docs/edge/guides/bootstrapping/vault#deploy-configuration-module
  context.stdout.write("7.e. Deploying Vault configuration module\n");

  // The spawned processes need to inherit the environment variables
  // so we'll merge the current environment variables with the new ones
  const env = {
    ...process.env,
    VAULT_ADDR: "http://127.0.0.1:8200",
    VAULT_TOKEN: recoveryKeys.root_token,
  };

  const pid = startBackgroundProcess({
    command: "kubectl",
    args: [
      "-n",
      "vault",
      "port-forward",
      "--address",
      "0.0.0.0",
      "svc/vault-active",
      "8200:8200",
    ],
    context,
    env,
  });

  await ensureFileExists({
    context,
    destinationFile: "./vault_core_resources/terragrunt.hcl",
    sourceFile: await Bun.file(vaultCoreResourcesTerragruntHcl).text(),
  });

  tfInit({
    context,
    env,
    verbose,
    workingDirectory: "./vault_core_resources",
  });

  apply({
    context,
    suppressErrors: true,
    verbose,
    env,
    workingDirectory: "./vault_core_resources",
  });

  // To mitigate the long-running background process dying over time, we'll kill it here
  // and restart it when we need it.
  if (pid > 0) {
    try {
      process.kill(pid);
    } catch {
      // Do nothing as it's already dead
    }
  }
};
