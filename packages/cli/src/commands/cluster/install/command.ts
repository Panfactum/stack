import path, { join } from "node:path";
import { select, input } from "@inquirer/prompts";
import { Glob } from "bun";
import { Command } from "clipanion";
import { z } from "zod";
import { applyColors } from "@/util/colors/applyColors";
import { PanfactumCommand } from "@/util/command/panfactumCommand";
import { upsertConfigValues } from "@/util/config/upsertConfigValues";
import { CLIError } from "@/util/error/error";
import { directoryExists } from "@/util/fs/directoryExist";
import { killAllBackgroundProcesses } from "@/util/subprocess/killBackgroundProcess";
import { MODULES } from "@/util/terragrunt/constants";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import { setSLA } from "./setSLA";
import { setupAutoscaling } from "./setupAutoscaling";
import { setupCertificateIssuers } from "./setupCertIssuers";
import { setupCertManagement } from "./setupCertManagement";
import { setupClusterExtensions } from "./setupClusterExtensions";
import { setupCSIDrivers } from "./setupCSIDrivers";
import { setupEKS } from "./setupEKS";
import { setupInboundNetworking } from "./setupInboundNetworking";
import { setupInternalClusterNetworking } from "./setupInternalClusterNetworking";
import { setupLinkerd } from "./setupLinkerd";
import { setupPolicyController } from "./setupPolicyController";
import { setupVault } from "./setupVault";
import { setupVPCandECR } from "./setupVPCandECR";
import { getPanfactumConfig } from "../../config/get/getPanfactumConfig";
import type { InstallClusterStepOptions } from "./common";

// Ripped from https://github.com/validatorjs/validator.js and customized for our needs
function isFQDN(str: string) {
  const parts = str.split('.');
  const tld = parts[parts.length - 1];

  if (!tld) {
    return false;
  }

  // disallow fqdns without tld
  if (parts.length < 2) {
    return false;
  }

  // disallow invalid TLDs
  if (!/^([a-z\u00A1-\u00A8\u00AA-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]{2,}|xn[a-z0-9-]{2,})$/i.test(tld)) {
    return false;
  }

  // disallow spaces
  if (/\s/.test(tld)) {
    return false;
  }


  // reject numeric TLDs
  if (/^\d+$/.test(tld)) {
    return false;
  }

  return parts.every((part) => {
    // disallow parts longer than 63 characters
    if (part.length > 63) {
      return false;
    }

    // disallow parts with invalid characters
    if (!/^[a-z_\u00a1-\uffff0-9-]+$/i.test(part)) {
      return false;
    }

    // disallow full-width chars
    if (/[\uff01-\uff5e]/.test(part)) {
      return false;
    }

    // disallow parts starting or ending with hyphen
    if (/^-|-$/.test(part)) {
      return false;
    }

    // disallow underscores
    // eslint-disable-next-line sonarjs/prefer-single-boolean-return
    if (/_/.test(part)) {
      return false;
    }

    return true;
  });
}

const SETUP_STEPS: Array<{
  label: string;
  id: string;
  setup: (
    options: InstallClusterStepOptions,
    completed: boolean
  ) => Promise<void>;
  completed: boolean;
  lastModule: MODULES; // Used to determine if the step has been completed
}> = [
    {
      label: "AWS VPC and ECR",
      id: "setupVPCandECR",
      setup: setupVPCandECR,
      completed: false,
      lastModule: MODULES.AWS_ECR_PULL_THROUGH_CACHE,
    },
    {
      label: "Base EKS Cluster",
      id: "setupEKS",
      setup: setupEKS,
      completed: false,
      lastModule: MODULES.AWS_EKS,
    },
    {
      label: "Internal Cluster Networking",
      id: "setupInternalClusterNetworking",
      setup: setupInternalClusterNetworking,
      completed: false,
      lastModule: MODULES.KUBE_CORE_DNS,
    },
    {
      label: "Policy Controller",
      id: "setupPolicyController",
      setup: setupPolicyController,
      completed: false,
      lastModule: MODULES.KUBE_POLICIES,
    },
    {
      label: "CSI Drivers",
      id: "setupCSIDrivers",
      setup: setupCSIDrivers,
      completed: false,
      lastModule: MODULES.KUBE_AWS_EBS_CSI,
    },
    {
      label: "Vault",
      id: "setupVault",
      setup: setupVault,
      completed: false,
      lastModule: MODULES.VAULT_CORE_RESOURCES,
    },
    {
      label: "Certificate Management",
      id: "setupCertManagement",
      setup: setupCertManagement,
      completed: false,
      lastModule: MODULES.KUBE_CERT_MANAGER,
    },
    {
      label: "Certificate Issuers",
      id: "setupCertificateIssuers",
      setup: setupCertificateIssuers,
      completed: false,
      lastModule: MODULES.KUBE_CERT_ISSUERS,
    },
    {
      label: "Linkerd",
      id: "setupLinkerd",
      setup: setupLinkerd,
      completed: false,
      lastModule: MODULES.KUBE_LINKERD,
    },
    {
      label: "Autoscaling",
      id: "setupAutoscaling",
      setup: setupAutoscaling,
      completed: false,
      lastModule: MODULES.KUBE_SCHEDULER,
    },
    {
      label: "Inbound Networking",
      id: "setupInboundNetworking",
      setup: setupInboundNetworking,
      completed: false,
      lastModule: MODULES.KUBE_INGRESS_NGINX,
    },
    {
      label: "Cluster Extensions",
      id: "setupClusterExtensions",
      setup: setupClusterExtensions,
      completed: false,
      lastModule: MODULES.KUBE_RELOADER,
    },
  ];

export class InstallClusterCommand extends PanfactumCommand {
  static override paths = [["cluster", "install"]];

  static override usage = Command.Usage({
    description: "Install a Panfactum cluster",
    details:
      "This command sets up a new Panfactum cluster including collecting configuration options and setting up all standard components.",
    examples: [["Start cluster installation", "pf cluster install"]],
  });

  async execute() {
    this.context.logger.log("Starting Panfactum cluster installation process", {
      style: "important",
      trailingNewlines: 1,
    });

    /*******************************************
     * Config Loading + Checks
     *
     * Loads the configuration necessary for the installation process
     *******************************************/
    const config = await getPanfactumConfig({
      context: this.context,
      directory: process.cwd(),
    });

    this.context.logger.log(
      `Panfactum Config: ${JSON.stringify(config, null, 2)}`,
      { level: "debug" }
    );

    const {
      aws_profile: awsProfile,
      domains,
      environment,
      kube_config_context: kubeConfigContext,
      kube_domain: kubeDomain,
      region,
      sla_target: slaTarget,
    } = config;

    if (!environment || !region || !awsProfile) {
      throw new CLIError([
        "Cluster installation must be run from within a valid region-specific directory.",
        "If you do not have this file structure please ensure you've completed the initial setup steps here:",
        "https://panfactum.com/docs/edge/guides/bootstrapping/configuring-infrastructure-as-code#setting-up-your-repo",
      ]);
    }

    if (!domains) {
      throw new CLIError([
        "At least one domain must be available in the environment to install a cluster.",
        "Please run `pf env add -e {environment}` to add a domain to the environment.",
      ]);
    }

    const environmentPath = path.join(
      this.context.repoVariables.environments_dir,
      environment
    );
    const clusterPath = path.join(environmentPath, region);

    /***********************************************
     * Confirms the SLA target for the cluster
     ***********************************************/
    const confirmedSLATarget = await setSLA({
      clusterPath,
      context: this.context,
      slaTarget,
    });

    if (!kubeDomain) {
      const subdomain: string = await select({
        message:
          applyColors(
            "Select the domain your cluster will live under", { style: "question" }
          ),
        choices: Object.keys(domains),
      });

      // TODO: already have validation built, use that.
      // Validate input to not have periods in it.
      const kubeDomain = await input({
        message: applyColors("Enter the subdomain for the cluster where all cluster utilities will be hosted", { style: "question" }),
        default: `${region}.${subdomain}`,
        validate: async (value) => {
          if (!isFQDN(`${value}.${subdomain}`)) {
            return "Invalid subdomain";
          }
          try {
            const glob = new Glob('**/region.yaml')
            // Find all region.yaml files across all environments
            const regionFiles = Array.from(glob.scanSync(environmentPath));

            for (const regionFile of regionFiles) {
              // Skip checking the current cluster's region.yaml
              if (regionFile === join(clusterPath, "region.yaml")) continue;

              // Read and parse the region.yaml file
              const yamlContent = await readYAMLFile({ filePath: regionFile, context: this.context, validationSchema: z.object({ kube_domain: z.string() }) });

              // Check if this region.yaml has a kube_domain that matches our proposed domain
              if (yamlContent && yamlContent.kube_domain === `${value}.${subdomain}`) {
                return `Domain ${value}.${subdomain} is already used by another cluster`;
              }
            }
          } catch (error) {
            this.context.logger.log(`Error checking existing domains: ${JSON.stringify(error, null, 2)}`, { level: "debug" });
            // Continue even if there's an error reading files
          }

          return true;
        },
        transformer: (value) => {
          return `${value}.${subdomain}`;
        },
        required: true,
      })

      await upsertConfigValues({
        filePath: join(clusterPath, "region.yaml"),
        values: {
          kube_domain: `${kubeDomain}.${subdomain}`,
        },
        context: this.context,
      });
    }

    /***********************************************
     * Main Setup Driver
     *
     * Executes each step in SETUP_STEPS sequentially
     *  and provides checkpointing functionality
     ***********************************************/
    const options: InstallClusterStepOptions = {
      awsProfile,
      context: this.context,
      environment,
      domains,
      environmentPath,
      kubeConfigContext,
      region,
      clusterPath,
      slaTarget: confirmedSLATarget,
    };

    // Check each step and mark as completed if directory exists
    for (const step of SETUP_STEPS) {
      const moduleDir = join(clusterPath, step.lastModule);
      step.completed = await directoryExists(moduleDir);
    }

    // Update the last completed module to not completed to re-check it
    const completedModules = SETUP_STEPS.filter(
      (step) => step.completed
    ).length;
    if (completedModules > 0) {
      SETUP_STEPS[completedModules - 1]!.completed = false;
    }

    for (const [_, { setup, label, completed }] of SETUP_STEPS.entries()) {
      try {
        await setup({ ...options }, completed);
      } catch (e) {
        killAllBackgroundProcesses({ context: this.context });
        throw new CLIError(`${label} setup failed`, e);
      }
    }

    this.context.logger.clusterInstallSuccess();
  }
}
