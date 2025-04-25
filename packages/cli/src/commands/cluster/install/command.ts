import path, { join } from "node:path";
import { Command } from "clipanion";
import { PanfactumCommand } from "@/util/command/panfactumCommand";
import { CLIError } from "@/util/error/error";
import { directoryExists } from "@/util/fs/directoryExist";
import { killAllBackgroundProcesses } from "@/util/subprocess/killBackgroundProcess";
import { MODULES } from "@/util/terragrunt/constants";
import { setSLA } from "./setSLA";
import { setupAutoscaling } from "./setupAutoscaling";
import { setupCertificateIssuers } from "./setupCertIssuers";
import { setupCertManagement } from "./setupCertManagement";
import { setupCSIDrivers } from "./setupCSIDrivers";
import { setupEKS } from "./setupEKS";
import { setupInboundNetworking } from "./setupInboundNetworking";
import { setupInternalClusterNetworking } from "./setupInternalClusterNetworking";
import { setupLinkerd } from "./setupLinkerd";
import { setupPolicyController } from "./setupPolicyController";
import { setupSupportServices } from "./setupSupportServices";
import { setupVault } from "./setupVault";
import { setupVPCandECR } from "./setupVPCandECR";
import { getPanfactumConfig } from "../../config/get/getPanfactumConfig";
import type { InstallClusterStepOptions } from "./common";

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
    // TODO: @seth - It feels like inbound networking should come
    // ASAP b/c getting vault off of the vault proxy
    // is critical for reliability of the install
    // The proxy is fairly flaky and can cause disruptions
    // if the connected vault pod restarts for some reason.
    // This will start to occur more frequently immediately after enabling autoscaling
    {
      label: "Support Services",
      id: "setupSupportServices",
      setup: setupSupportServices,
      completed: false,
      lastModule: MODULES.KUBE_RELOADER,
    },
    {
      label: "Inbound Networking",
      id: "setupInboundNetworking",
      setup: setupInboundNetworking,
      completed: false,
      lastModule: MODULES.KUBE_INGRESS_NGINX,
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
      environment,
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


    // TODO: verify at least one domain available in environment
    // tell them to run `pf env add -e {environment}` if not

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

    // TODO: decide domain for the cluster
    // Two steps:
    //  (1) Which ancestor domain
    //  (2) What is the subdomain for the cluster (explain that all cluster utilities (vault, etc.) will be hosted under this)
    //      provide recommendation
    // Validation:
    // - MUST be valid DNS string
    // - MUST not be taken by another cluster (verify against ALL environments/clusters)
    //
    // Saved under `kube_domain` for the region

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
      environmentDomain,
      environmentPath,
      // TODO: Remove this once we have a user defined and validated kubeDomain
      kubeDomain: kubeDomain!,
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
