import { join } from "node:path";
import awsLbControllerSla1TerragruntHcl from "@/templates/kube_aws_lb_controller_sla_1_terragrunt.hcl" with { type: "file" };
import awsLbControllerSla2TerragruntHcl from "@/templates/kube_aws_lb_controller_sla_2_terragrunt.hcl" with { type: "file" };
import kubeBastionTerragruntHcl from "@/templates/kube_bastion_terragrunt.hcl" with { type: "file" };
import kubeExternalDnsTerragruntHcl from "@/templates/kube_external_dns_terragrunt.hcl" with { type: "file" };
import kubeNginxIngressTerragruntHcl from "@/templates/kube_ingress_nginx_terragrunt.hcl" with { type: "file" };
import { upsertConfigValues } from "@/util/config/upsertConfigValues";
import { CLIError } from "@/util/error/error";
import { extractRoute53ZoneKeys } from "@/util/extract-route53-zone-keys";
import { sopsUpsert } from "@/util/sops/sopsUpsert";
import { killBackgroundProcess } from "@/util/subprocess/backgroundProcess";
import { execute } from "@/util/subprocess/execute";
import { startVaultProxy } from "@/util/subprocess/vaultProxy";
import { replaceHCLValue } from "@/util/terragrunt/replaceHCLValue";
import { terragruntApply } from "@/util/terragrunt/terragruntApply";
import { deployModule } from "./deployModule";
import { informStepStart, informStepComplete } from "./messages";
import type { InstallClusterStepOptions } from "./common";

export async function setupInboundNetworking(
  options: InstallClusterStepOptions
) {
  const { checkpointer, clusterPath, kubeDomain, slaTarget, context, stepNum } =
    options;

  const vaultDomain = await checkpointer.getSavedInput("vaultDomain");
  if (typeof vaultDomain !== "string") {
    throw new CLIError(
      "Vault domain is not a string and can't be used to update the configuration"
    );
  }
  const vaultDomainWithProtocol = `https://${vaultDomain}`;

  const VAULT_TOKEN = await checkpointer.getSavedInput("vaultRootToken");
  const VAULT_ADDR = await checkpointer.getSavedInput("vaultAddress");
  const env = { ...process.env, VAULT_ADDR, VAULT_TOKEN };

  const pid = await startVaultProxy({
    env,
    modulePath: clusterPath,
  });

  /***************************************************
   * Deploy the ExternalDNS Module
   ***************************************************/
  await deployModule({
    ...options,
    moduleDirectory: "kube_external_dns",
    terraguntContents: await Bun.file(kubeExternalDnsTerragruntHcl).text(),
    subStepNum: 1,
    stepName: "ExternalDNS Deployment",
    stepId: "deployExternalDns",
  });

  /***************************************************
   * Deploy the AWS Load Balancer Controller Module
   ***************************************************/
  const templateFile =
    slaTarget === 1
      ? awsLbControllerSla1TerragruntHcl
      : awsLbControllerSla2TerragruntHcl;

  await deployModule({
    ...options,
    subStepNum: 2,
    moduleDirectory: "kube_aws_lb_controller",
    terraguntContents: templateFile,
    stepName: "AWS Load Balancer Controller Deployment",
    stepId: "deployAwsLbController",
  });

  /***************************************************
   * Generate the dharam secret
   ***************************************************/
  const subStepLabel = "Generating the Ingress Secret";
  const subStepNumber = 3;
  const generateIngressSecretId = "generateIngressSecret";
  if (await checkpointer.isStepComplete(generateIngressSecretId)) {
    informStepComplete(context, subStepLabel, stepNum, subStepNumber);
  } else {
    informStepStart(context, subStepLabel, stepNum, subStepNumber);

    context.logger.log([
      "Generating a key used for TLS security",
      "⏰ This may take a few minutes as it depends on your computer",
    ]);

    const generatingSecret = context.logger.progressMessage(
      "Generating the dhparam secret",
      {
        interval: 10000,
      }
    );

    const { stdout } = await execute({
      command: ["openssl", "dhparam", "-dsaparam", "4096"],
      context,
      workingDirectory: clusterPath,
    });

    generatingSecret();

    const secretsPath = join(
      join(clusterPath, "kube_ingress_nginx"),
      "secrets.yaml"
    );
    // TODO: @seth Check if this works with this multi-line string
    await sopsUpsert({
      context,
      filePath: secretsPath,
      values: { dhparam: stdout },
    });

    await checkpointer.setStepComplete(generateIngressSecretId);
  }

  /***************************************************
   * Deploy the Nginx Ingress Module
   ***************************************************/
  const ingressDomains = extractRoute53ZoneKeys({
    context,
    filePath: join(clusterPath, "kube_cert_issuers", "terragrunt.hcl"),
  });

  await deployModule({
    ...options,
    subStepNum: 4,
    moduleDirectory: "kube_ingress_nginx",
    terraguntContents: await Bun.file(kubeNginxIngressTerragruntHcl).text(),
    stepName: "Nginx Ingress Deployment",
    stepId: "deployNginxIngress",
    hclUpdates: {
      "inputs.ingress_domains": ingressDomains,
      "inputs.sla_level": slaTarget,
    },
  });

  /***************************************************
   * Deploy the Vault Ingress Module
   ***************************************************/
  const vaultIngressSubStepLabel = "Setting up the Vault Ingress";
  const vaultIngressSubStepNumber = 5;
  const setupVaultIngressId = "deployVaultIngress";
  if (await checkpointer.isStepComplete(setupVaultIngressId)) {
    informStepComplete(
      context,
      vaultIngressSubStepLabel,
      stepNum,
      vaultIngressSubStepNumber
    );
  } else {
    informStepStart(
      context,
      vaultIngressSubStepLabel,
      stepNum,
      vaultIngressSubStepNumber
    );

    await replaceHCLValue(
      join(clusterPath, "kube_vault", "terragrunt.hcl"),
      "inputs.ingress_enabled",
      true
    );

    const finishVaultProgress = context.logger.progressMessage(
      "Setting up the Vault Ingress",
      {
        successMessage: "Successfully setup the Vault Ingress.",
      }
    );
    await terragruntApply({
      context,
      env,
      workingDirectory: join(clusterPath, "kube_vault"),
    });
    finishVaultProgress();

    const vaultDomain = await checkpointer.getSavedInput("vaultDomain");
    if (typeof vaultDomain !== "string") {
      throw new CLIError(
        "Vault domain is not a string and can't be used to update the configuration"
      );
    }

    await execute({
      command: ["delv", "@1.1.1.1", vaultDomain],
      context,
      workingDirectory: join(clusterPath, "kube_vault"),
      retries: 30,
      retryDelay: 10000,
      isSuccess: ({ stdout }) => {
        return (
          (stdout as string).includes("; fully validated") &&
          !(stdout as string).includes("; negative response, fully validated")
        );
      },
    });

    await checkpointer.setStepComplete(setupVaultIngressId);
  }

  /***************************************************
   * Update the Vault Address
   ***************************************************/
  const vaultAddrUpdateSubStepLabel = "Updating the Vault Address";
  const vaultAddrUpdateSubStepNumber = 6;
  const updateVaultAddrId = "updateVaultAddress";
  if (await checkpointer.isStepComplete(updateVaultAddrId)) {
    informStepComplete(
      context,
      vaultAddrUpdateSubStepLabel,
      stepNum,
      vaultAddrUpdateSubStepNumber
    );
  } else {
    informStepStart(
      context,
      vaultAddrUpdateSubStepLabel,
      stepNum,
      vaultAddrUpdateSubStepNumber
    );

    await upsertConfigValues({
      filePath: join(clusterPath, "region.yaml"),
      values: {
        vault_addr: vaultDomainWithProtocol,
      },
    });

    const vaultIngressFinished = context.logger.progressMessage(
      "Updating resources with new public Vault URL",
      {
        successMessage: "Successfully updated the Vault address.",
      }
    );
    terragruntApply({
      context,
      env,
      workingDirectory: join(clusterPath, "vault_core_resources"),
    });
    vaultIngressFinished();

    await checkpointer.setStepComplete(updateVaultAddrId);
  }

  /***************************************************
   * Deploy the Bastion Module
   ***************************************************/
  await deployModule({
    ...options,
    subStepNum: 7,
    moduleDirectory: "kube_bastion",
    terraguntContents: await Bun.file(kubeBastionTerragruntHcl).text(),
    stepName: "Bastion Deployment",
    stepId: "deployBastion",
    hclUpdates: {
      "inputs.bastion_domains": [`bastion.${kubeDomain}`],
    },
  });

  /***************************************************
   * Configure Bastion Connectivity
   ***************************************************/
  const bastionConnectivitySubStepLabel = "Configuring Bastion Connectivity";
  const bastionConnectivitySubStepNumber = 8;
  const configureBastionConnectivityId = "configureBastionConnectivity";
  if (await checkpointer.isStepComplete(configureBastionConnectivityId)) {
    informStepComplete(
      context,
      bastionConnectivitySubStepLabel,
      stepNum,
      bastionConnectivitySubStepNumber
    );
  } else {
    informStepStart(
      context,
      bastionConnectivitySubStepLabel,
      stepNum,
      bastionConnectivitySubStepNumber
    );

    // FIX: @jack
    // await updateSSH({
    //   context,
    //   verbose,
    // });

    await checkpointer.setStepComplete(configureBastionConnectivityId);
  }

  killBackgroundProcess({ pid, context });
}
