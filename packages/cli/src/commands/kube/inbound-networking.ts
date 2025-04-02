import { $ } from "bun";
import yaml from "yaml";
import awsLbControllerSla1TerragruntHcl from "../../templates/kube_aws_lb_controller_sla_1_terragrunt.hcl" with { type: "file" };
import awsLbControllerSla2TerragruntHcl from "../../templates/kube_aws_lb_controller_sla_2_terragrunt.hcl" with { type: "file" };
import kubeBastionTerragruntHcl from "../../templates/kube_bastion_terragrunt.hcl" with { type: "file" };
import kubeExternalDnsTerragruntHcl from "../../templates/kube_external_dns_terragrunt.hcl" with { type: "file" };
import kubeIngressNginxTerragruntHcl from "../../templates/kube_ingress_nginx_terragrunt.hcl" with { type: "file" };
import { ensureFileExists } from "../../util/ensure-file-exists";
import { extractRoute53ZoneKeys } from "../../util/extract-route53-zone-keys";
import { getConfigFileKey } from "../../util/get-config-file-key";
import { progressMessage } from "../../util/progress-message";
import { replaceHclValue } from "../../util/replace-hcl-value";
import { replaceYamlValue } from "../../util/replace-yaml-value";
import { getRepoVariables } from "../../util/scripts/get-repo-variables";
import { getTerragruntVariables } from "../../util/scripts/get-terragrunt-variables";
import { tfInit } from "../../util/scripts/tf-init";
import { updateSSH } from "../../util/scripts/update-ssh";
import { sopsEncrypt } from "../../util/sops-encrypt";
import { startBackgroundProcess } from "../../util/start-background-process";
import { apply } from "../terragrunt/apply";
import type { BaseContext } from "clipanion";

export const setupInboundNetworking = async ({
  context,
  configPath,
  verbose = false,
}: {
  context: BaseContext;
  configPath: string;
  verbose?: boolean;
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

  // https://panfactum.com/docs/edge/guides/bootstrapping/inbound-networking#deploy-externaldns
  context.stdout.write("11.a. Setting up ExternalDNS\n");

  await ensureFileExists({
    context,
    destinationFile: "./kube_external_dns/terragrunt.hcl",
    sourceFile: await Bun.file(kubeExternalDnsTerragruntHcl).text(),
  });

  tfInit({
    context,
    env,
    verbose,
    workingDirectory: "./kube_external_dns",
  });

  apply({
    context,
    env,
    verbose,
    workingDirectory: "./kube_external_dns",
  });

  // https://panfactum.com/docs/edge/guides/bootstrapping/inbound-networking#deploy-the-aws-load-balancer-controller
  context.stdout.write("11.b. Setting up the AWS Load Balancer Controller\n");

  const terragruntVariables = await getTerragruntVariables({
    context,
  });
  const templateFile =
    terragruntVariables.sla_target === 1
      ? awsLbControllerSla1TerragruntHcl
      : awsLbControllerSla2TerragruntHcl;

  await ensureFileExists({
    context,
    destinationFile: "./kube_aws_lb_controller/terragrunt.hcl",
    sourceFile: await Bun.file(templateFile).text(),
  });

  tfInit({
    context,
    env,
    verbose,
    workingDirectory: "./kube_aws_lb_controller",
  });

  apply({
    context,
    env,
    verbose,
    workingDirectory: "./kube_aws_lb_controller",
  });

  // https://panfactum.com/docs/edge/guides/bootstrapping/inbound-networking#deploy-the-ingress-system
  context.stdout.write("11.c. Generating a key used for TLS security\n");
  context.stdout.write(
    "⏰ This may take a few minutes as it depends on your computer\n"
  );
  let dhparamProgress: globalThis.Timer | undefined;
  if (!verbose) {
    dhparamProgress = progressMessage({
      context,
      message: "Generating a key used for TLS security",
    });
  }

  const generatedSecret = await $`openssl dhparam 4096 2> /dev/null`.text();

  !verbose && globalThis.clearInterval(dhparamProgress);
  context.stdout.write("\n");

  await sopsEncrypt({
    context,
    filePath: "./kube_ingress_nginx/secrets.yaml",
    fileContents: `dhparam: |-\n    ${generatedSecret.split("\n").join("\n    ")}`,
    errorMessage: "Failed to encrypt Ingress secrets",
    tempFilePath: "./.tmp-ingress-secrets.yaml",
  });

  context.stdout.write("11.d. Setting up the Ingress System\n");
  await ensureFileExists({
    context,
    destinationFile: "./kube_ingress_nginx/terragrunt.hcl",
    sourceFile: await Bun.file(kubeIngressNginxTerragruntHcl).text(),
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

  tfInit({
    context,
    env,
    verbose,
    workingDirectory: "./kube_ingress_nginx",
  });

  apply({
    context,
    env,
    verbose,
    workingDirectory: "./kube_ingress_nginx",
  });

  // https://panfactum.com/docs/edge/guides/bootstrapping/inbound-networking#deploy-the-vault-ingress
  context.stdout.write("11.e. Setting up the Vault Ingress\n");

  replaceHclValue(
    "./kube_vault/terragrunt.hcl",
    "inputs.ingress_enabled",
    true
  );

  apply({
    context,
    env,
    verbose,
    workingDirectory: "./kube_vault",
  });

  context.stdout.write("11.f. Updating resources with new public Vault URL\n");
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

  await replaceYamlValue(
    "./region.yaml",
    "vault_addr",
    vaultDomainWithProtocol
  );

  apply({
    context,
    env,
    verbose,
    workingDirectory: "./vault_core_resources",
  });

  // https://panfactum.com/docs/edge/guides/bootstrapping/inbound-networking#deploy-the-bastion
  context.stdout.write("11.g. Setting up the Bastion\n");

  await ensureFileExists({
    context,
    destinationFile: "./kube_bastion/terragrunt.hcl",
    sourceFile: await Bun.file(kubeBastionTerragruntHcl).text(),
  });

  // Remove the vault prefix from the domain and add a bastion prefix
  const bastionDomain = `bastion.${vaultDomain.split(".").slice(1).join(".")}`;
  await replaceHclValue(
    "./kube_bastion/terragrunt.hcl",
    "inputs.bastion_domains",
    [bastionDomain]
  );

  tfInit({
    context,
    env,
    verbose,
    workingDirectory: "./kube_bastion",
  });

  apply({
    context,
    env,
    verbose,
    workingDirectory: "./kube_bastion",
  });

  // https://panfactum.com/docs/edge/guides/bootstrapping/inbound-networking#configure-bastion-connectivity
  context.stdout.write("11.h. Configuring Bastion Connectivity\n");

  await updateSSH({
    context,
    verbose,
  });

  const clusterName = await getConfigFileKey({
    key: "clusterName",
    configPath,
    context,
  });

  if (typeof clusterName !== "string") {
    throw new Error(
      "Cluster name is not a string and can't be used to setup the .ssh/config.yaml file"
    );
  }

  const sshJsonConfig = {
    bastions: [
      {
        name: clusterName,
        module: `${terragruntVariables.environment}/${terragruntVariables.region}/kube_bastion`,
        vault: vaultDomain,
      },
    ],
  };

  const repoVariables = await getRepoVariables({ context });

  await Bun.write(
    `${repoVariables.ssh_dir}/config.yaml`,
    yaml.stringify(sshJsonConfig)
  );

  await updateSSH({
    buildKnownHosts: true,
    context,
    verbose,
  });

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
