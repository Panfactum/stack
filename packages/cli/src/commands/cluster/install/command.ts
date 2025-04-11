import path from "node:path";
import { Command } from "clipanion";
import { PanfactumCommand } from "@/util/command/panfactumCommand";
import { CLIError } from "@/util/error/error";
import { Checkpointer, type Step } from "./checkpointer";
import { informStepComplete, informStepStart } from "./messages";
import { setSLA } from "./setSLA";
import { setupAutoscaling } from "./setupAutoscaling";
import { setupCertificateIssuers } from "./setupCertIssuers";
import { setupCertManagement } from "./setupCertManagement";
import { setupCloudNativePG } from "./setupCloudNativePG";
import { setupCSIDrivers } from "./setupCSIDrivers";
import { setupECR } from "./setupECR";
import { setupEKS } from "./setupEKS";
import { setupInboundNetworking } from "./setupInboundNetworking";
import { setupInternalClusterNetworking } from "./setupInternalClusterNetworking";
import { setupLinkerd } from "./setupLinkerd";
import { setupMaintenanceControllers } from "./setupMaintenanceControllers";
import { setupPolicyController } from "./setupPolicyController";
import { setupVault } from "./setupVault";
import { setupVaultCoreResources } from "./setupVaultCoreResources";
import { setupVPC } from "./setupVPC";
import { getPanfactumConfig } from "../../config/get/getPanfactumConfig";
import type { InstallClusterStepOptions } from "./common";

const SETUP_STEPS: Array<{
  label: string;
  id: Step;
  setup: (options: InstallClusterStepOptions) => Promise<void>;
  extraInfo?: string;
}> = [
  {
    label: "AWS VPC",
    id: "setupVPC",
    setup: setupVPC,
  },
  {
    label: "AWS ECR Pull Through Cache",
    id: "setupECRPullThroughCache",
    setup: setupECR,
  },
  {
    label: "Base EKS Cluster",
    id: "setupEKS",
    setup: setupEKS,
  },
  {
    label: "Internal Cluster Networking",
    id: "internalClusterNetworking",
    setup: setupInternalClusterNetworking,
    extraInfo:
      "⏰ NOTE: The cluster may take up to 20 minutes to be created after you answer a couple questions",
  },
  {
    label: "Policy Controller",
    id: "policyController",
    setup: setupPolicyController,
  },
  {
    label: "CSI Drivers",
    id: "csiDrivers",
    setup: setupCSIDrivers,
  },
  {
    label: "Vault",
    id: "setupVault",
    setup: setupVault,
  },
  {
    label: "Vault Core Resources",
    id: "setupVaultCoreResources",
    setup: setupVaultCoreResources,
  },
  {
    label: "Certificate Management",
    id: "setupCertManagement",
    setup: setupCertManagement,
  },
  {
    label: "Certificate Issuers",
    id: "setupCertificateIssuers",
    setup: setupCertificateIssuers,
  },
  {
    label: "Linkerd",
    id: "setupLinkerd",
    setup: setupLinkerd,
  },
  {
    label: "Autoscaling",
    id: "setupAutoscaling",
    setup: setupAutoscaling,
  },
  {
    label: "Inbound Networking",
    id: "setupInboundNetworking",
    setup: setupInboundNetworking,
  },
  {
    label: "Maintenance Controllers",
    id: "setupMaintenanceControllers",
    setup: setupMaintenanceControllers,
  },
  {
    label: "Cloud Native PostgreSQL",
    id: "setupCloudNativePG",
    setup: setupCloudNativePG,
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
      environment,
      kube_domain: kubeDomain,
      region,
      sla_target: slaTarget,
    } = config;

    if (!environment || !region || !kubeDomain) {
      throw new CLIError([
        "Cluster installation must be run from within a valid region-specific directory.",
        "If you do not have this file structure please ensure you've completed the initial setup steps here:",
        "https://panfactum.com/docs/edge/guides/bootstrapping/configuring-infrastructure-as-code#setting-up-your-repo",
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
      environmentPath,
      context: this.context,
      slaTarget,
    });

    /*******************************************
     * Checkpointer
     *
     * This allows us to skip steps that have already been completed
     * if this command is resumed
     *******************************************/
    const checkpointPath = path.join(
      clusterPath,
      ".cluster-install.checkpoint.json"
    );
    const checkpointer = new Checkpointer(this.context, checkpointPath);

    /***********************************************
     * Main Setup Driver
     *
     * Executes each step in SETUP_STEPS sequentially and provides
     * checkpointing functionality
     ***********************************************/

    const options: InstallClusterStepOptions = {
      context: this.context,
      environment,
      environmentPath,
      kubeDomain,
      region,
      checkpointer,
      clusterPath,
      slaTarget: confirmedSLATarget,
      stepNum: 0,
    };

    for (const [i, { setup, id, label, extraInfo }] of SETUP_STEPS.entries()) {
      if (await checkpointer.isStepComplete(id)) {
        informStepComplete(this.context, label, i);
      } else {
        informStepStart(this.context, label, i);
        try {
          if (extraInfo) {
            this.context.logger.log(extraInfo, { style: "important" });
          }
          await setup({ ...options, stepNum: i });
          await checkpointer.setStepComplete(id);
        } catch (e) {
          throw new CLIError(`${label} setup failed`, e);
        }
      }
    }

    this.context.logger.clusterInstallSuccess();
  }
}
