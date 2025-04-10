import { $ } from "bun";
import { getPanfactumConfig } from "@/commands/config/get/getPanfactumConfig";
import { terragruntInitAndApply } from "@/util/terragrunt/terragruntInitAndApply";
import awsLbControllerSla1TerragruntHcl from "../../../../templates/kube_aws_lb_controller_sla_1_terragrunt.hcl" with { type: "file" };
import awsLbControllerSla2TerragruntHcl from "../../../../templates/kube_aws_lb_controller_sla_2_terragrunt.hcl" with { type: "file" };
import kubeBastionTerragruntHcl from "../../../../templates/kube_bastion_terragrunt.hcl" with { type: "file" };
import kubeExternalDnsTerragruntHcl from "../../../../templates/kube_external_dns_terragrunt.hcl" with { type: "file" };
import kubeIngressNginxTerragruntHcl from "../../../../templates/kube_ingress_nginx_terragrunt.hcl" with { type: "file" };
import { checkStepCompletion } from "../../../../util/check-step-completion";
import { extractRoute53ZoneKeys } from "../../../../util/extract-route53-zone-keys";
import { writeFile } from "../../../../util/fs/writeFile";
import { getConfigFileKey } from "../../../../util/get-config-file-key";
import { replaceHclValue } from "../../../../util/replace-hcl-value";
import { replaceYamlValue } from "../../../../util/replace-yaml-value";
import { sopsEncrypt } from "../../../../util/sops-encrypt";
import { startBackgroundProcess } from "../../../../util/subprocess/backgroundProcess";
import { terragruntApply } from "../../../../util/terragrunt/terragruntApply";
import { updateConfigFile } from "../../../../util/update-config-file";
import { writeErrorToDebugFile } from "../../../../util/write-error-to-debug-file";
import type { PanfactumContext } from "@/context/context";

export const setupInboundNetworking = async ({
  context,
  configPath,
}: {
  context: PanfactumContext;
  configPath: string;
}) => {
  const env = process.env;
  const vaultPortForwardPid = startBackgroundProcess({
    args: [
      "-n",
      "vault",
      "port-forward",
      "--address",
      "0.0.0.0",
      "svc/vault-active",
      "8200:8200",
    ],
    command: "kubectl",
    context,
    env,
  });

  const terragruntVariables = await getPanfactumConfig({
    context,
  });

  const vaultDomain = await getConfigFileKey({
    key: "vaultDomain",
    configPath,
    context,
  });
  if (typeof vaultDomain !== "string") {
    throw new Error(
      "Vault domain is not a string and can't be used to update the region.yaml file"
    );
  }
  const vaultDomainWithProtocol = `https://${vaultDomain}`;

  // https://panfactum.com/docs/edge/guides/bootstrapping/inbound-networking#deploy-externaldns
  let externalDnsSetupComplete = false;
  try {
    externalDnsSetupComplete = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "setupExternalDns",
      stepCompleteMessage:
        "11.a. Skipping ExternalDNS setup as it's already complete.\n",
      stepNotCompleteMessage: "11.a. Setting up ExternalDNS\n",
    });
  } catch {
    throw new Error("Failed to check if ExternalDNS setup is complete");
  }

  if (!externalDnsSetupComplete) {
    await writeFile({
      context,
      path: "./kube_external_dns/terragrunt.hcl",
      contents: await Bun.file(kubeExternalDnsTerragruntHcl).text(),
    });

    await terragruntInitAndApply({
      context,
      modulePath: "./kube_external_dns",
    });

    await updateConfigFile({
      context,
      configPath,
      updates: {
        setupExternalDns: true,
      },
    });
  }

  // https://panfactum.com/docs/edge/guides/bootstrapping/inbound-networking#deploy-the-aws-load-balancer-controller
  let awsLbControllerSetupComplete = false;
  try {
    awsLbControllerSetupComplete = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "setupAwsLbController",
      stepCompleteMessage:
        "11.b. Skipping AWS Load Balancer Controller setup as it's already complete.\n",
      stepNotCompleteMessage:
        "11.b. Setting up the AWS Load Balancer Controller\n",
    });
  } catch {
    throw new Error(
      "Failed to check if AWS Load Balancer Controller setup is complete"
    );
  }

  if (!awsLbControllerSetupComplete) {
    const templateFile =
      terragruntVariables.sla_target === 1
        ? awsLbControllerSla1TerragruntHcl
        : awsLbControllerSla2TerragruntHcl;

    await writeFile({
      context,
      path: "./kube_aws_lb_controller/terragrunt.hcl",
      contents: await Bun.file(templateFile).text(),
    });

    await terragruntInitAndApply({
      context,
      moduleName: "AWS Load Balancer Controller",
      modulePath: "./kube_aws_lb_controller",
    });

    await updateConfigFile({
      context,
      configPath,
      updates: { setupAwsLbController: true },
    });
  }

  // https://panfactum.com/docs/edge/guides/bootstrapping/inbound-networking#deploy-the-ingress-system
  let ingressSystemSetupComplete = false;
  try {
    ingressSystemSetupComplete = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "setupIngressSystem",
      stepCompleteMessage:
        "11.c. Skipping Ingress System setup as it's already complete.\n",
      stepNotCompleteMessage: "11.c. Setting up the Ingress System\n",
    });
  } catch {
    throw new Error("Failed to check if Ingress System setup is complete");
  }

  if (!ingressSystemSetupComplete) {
    context.logger.log(
      `11.c. Generating a key used for TLS security
      ⏰ This may take a few minutes as it depends on your computer`
    );
    //let dhparamProgress: globalThis.Timer | undefined;

    // TODO
    // if (!verbose) {
    //   dhparamProgress = progressMessage({
    //     context,
    //     message: "Generating a key used for TLS security",
    //   });
    // }

    const generatedSecret = await $`openssl dhparam 4096 2> /dev/null`.text();

    // TODO
    // !verbose && globalThis.clearInterval(dhparamProgress);
    // context.stdout.write("\n");

    await sopsEncrypt({
      context,
      filePath: "./kube_ingress_nginx/secrets.yaml",
      fileContents: `dhparam: |-\n    ${generatedSecret.split("\n").join("\n    ")}`,
      errorMessage: "Failed to encrypt Ingress secrets",
      tempFilePath: "./.tmp-ingress-secrets.yaml",
    });

    context.logger.log("11.d. Setting up the Ingress System");

    await writeFile({
      context,
      path: "./kube_ingress_nginx/terragrunt.hcl",
      contents: await Bun.file(kubeIngressNginxTerragruntHcl).text(),
    });

    const ingressDomains = extractRoute53ZoneKeys({
      context,
      filePath: "./kube_cert_issuers/terragrunt.hcl",
    });

    replaceHclValue(
      "./kube_ingress_nginx/terragrunt.hcl",
      "inputs.sla_level",
      terragruntVariables.sla_target ?? 2
    );

    replaceHclValue(
      "./kube_ingress_nginx/terragrunt.hcl",
      "inputs.ingress_domains",
      ingressDomains
    );

    // Format the file
    Bun.spawnSync([
      "terragrunt",
      "hclfmt",
      "./kube_ingress_nginx/terragrunt.hcl",
    ]);

    await terragruntInitAndApply({
      context,
      moduleName: "Ingress System",
      modulePath: "./kube_ingress_nginx",
    });

    await updateConfigFile({
      context,
      configPath,
      updates: { setupIngressSystem: true },
    });
  }

  // https://panfactum.com/docs/edge/guides/bootstrapping/inbound-networking#deploy-the-vault-ingress
  let vaultIngressSetupComplete = false;
  try {
    vaultIngressSetupComplete = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "setupVaultIngress",
      stepCompleteMessage:
        "11.e. Skipping Vault Ingress setup as it's already complete.\n",
      stepNotCompleteMessage: "11.e. Setting up the Vault Ingress\n",
    });
  } catch {
    throw new Error("Failed to check if Vault Ingress setup is complete");
  }

  if (!vaultIngressSetupComplete) {
    replaceHclValue(
      "./kube_vault/terragrunt.hcl",
      "inputs.ingress_enabled",
      true
    );

    try {
      const finishVaultProgress = context.logger.progressMessage(
        "Setting up the Vault Ingress",
        {
          successMessage: "Successfully setup the Vault Ingress.",
        }
      );
      terragruntApply({
        context,
        env,
        workingDirectory: "./kube_vault",
      });
      finishVaultProgress();
    } catch (error) {
      writeErrorToDebugFile({
        context,
        error,
      });
      throw new Error("Failed to setup Vault");
    }

    // Wait for DNS propagation before continuing
    let dnsResolved = false;
    let count = 0;
    const maxRetries = 30; // 5 minutes (30 * 10 seconds)

    while (!dnsResolved) {
      // Wait for 10 seconds between checks
      await new Promise((resolve) => globalThis.setTimeout(resolve, 10000));

      // Check if we've exceeded the timeout
      if (count >= maxRetries) {
        throw new Error(
          `DNS propagation for ${vaultDomainWithProtocol} failed after 5 minutes`
        );
      }

      try {
        // Use delv to check DNS resolution
        const result = await $`delv @1.1.1.1 ${vaultDomain}`.text();

        context.logger.log(`DNS check result: ${result}`, { level: "debug" });

        // Check for successful validation without negative response
        if (
          result.includes("; fully validated") &&
          !result.includes("; negative response, fully validated")
        ) {
          dnsResolved = true;
        }
      } catch (error) {
        writeErrorToDebugFile({
          context,
          error,
        });

        context.logger.log(`DNS check error: ${JSON.stringify(error)}`, {
          level: "debug",
        });
        // Continue trying even if the command fails
      }

      count++;
    }

    await updateConfigFile({
      context,
      configPath,
      updates: { setupVaultIngress: true },
    });
  }

  let vaultAddrUpdateComplete = false;
  try {
    vaultAddrUpdateComplete = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "updateVaultAddr",
      stepCompleteMessage:
        "11.f. Skipping Vault address update as it's already complete.\n",
      stepNotCompleteMessage:
        "11.f. Updating resources with new public Vault URL\n",
    });
  } catch {
    throw new Error("Failed to check if Vault address update is complete");
  }

  if (!vaultAddrUpdateComplete) {
    await replaceYamlValue(
      "./region.yaml",
      "vault_addr",
      vaultDomainWithProtocol
    );

    try {
      const vaultIngressFinished = context.logger.progressMessage(
        "Updating resources with new public Vault URL",
        {
          successMessage: "Successfully updated the Vault address.",
        }
      );

      terragruntApply({
        context,
        env,
        workingDirectory: "./vault_core_resources",
      });
      vaultIngressFinished();
    } catch (error) {
      writeErrorToDebugFile({
        context,
        error,
      });
      throw new Error("Failed to update the Vault address");
    }

    await updateConfigFile({
      context,
      configPath,
      updates: { updateVaultAddr: true },
    });
  }

  // https://panfactum.com/docs/edge/guides/bootstrapping/inbound-networking#deploy-the-bastion
  let bastionSetupComplete = false;
  try {
    bastionSetupComplete = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "setupBastion",
      stepCompleteMessage:
        "11.g. Skipping Bastion setup as it's already complete.\n",
      stepNotCompleteMessage: "11.g. Setting up the Bastion\n",
    });
  } catch {
    throw new Error("Failed to check if Bastion setup is complete");
  }

  if (!bastionSetupComplete) {
    await writeFile({
      context,
      path: "./kube_bastion/terragrunt.hcl",
      contents: await Bun.file(kubeBastionTerragruntHcl).text(),
    });

    // Remove the vault prefix from the domain and add a bastion prefix
    const bastionDomain = `bastion.${vaultDomain.split(".").slice(1).join(".")}`;
    await replaceHclValue(
      "./kube_bastion/terragrunt.hcl",
      "inputs.bastion_domains",
      [bastionDomain]
    );

    await terragruntInitAndApply({
      context,
      moduleName: "Bastion",
      modulePath: "./kube_bastion",
    });

    await updateConfigFile({
      context,
      configPath,
      updates: { setupBastion: true },
    });
  }

  // https://panfactum.com/docs/edge/guides/bootstrapping/inbound-networking#configure-bastion-connectivity
  let bastionConnectivityConfigComplete = false;
  try {
    bastionConnectivityConfigComplete = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "configureBastionConnectivity",
      stepCompleteMessage:
        "11.h. Skipping Bastion connectivity configuration as it's already complete.\n",
      stepNotCompleteMessage: "11.h. Configuring Bastion Connectivity\n",
    });
  } catch {
    throw new Error(
      "Failed to check if Bastion connectivity configuration is complete"
    );
  }

  if (!bastionConnectivityConfigComplete) {
    // TODO: Fix
    // await updateSSH({
    //   context,
    //   verbose,
    // });

    await updateConfigFile({
      context,
      configPath,
      updates: { configureBastionConnectivity: true },
    });
  }

  // To mitigate the long-running background process dying over time, we'll kill it here
  // and restart it when we need it.
  if (vaultPortForwardPid > 0) {
    try {
      process.kill(vaultPortForwardPid);
    } catch {
      // Do nothing as it's already dead
    }
  }
};
