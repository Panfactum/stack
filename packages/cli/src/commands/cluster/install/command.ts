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
import { setupCSIDrivers } from "./setupCSIDrivers";
import { setupECR } from "./setupECR";
import { setupEKS } from "./setupEKS";
import { setupInternalClusterNetworking } from "./setupInternalClusterNetworking";
import { setupLinkerd } from "./setupLinkerd";
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
  }

  //     let setupInboundNetworkingComplete = false;
  //     try {
  //       setupInboundNetworkingComplete = await checkStepCompletion({
  //         configFilePath: configPath,
  //         context: this.context,
  //         step: "inboundNetworking",
  //         stepCompleteMessage:
  //           "11/13 Skipping inbound networking setup as it's already complete.\n",
  //         stepNotCompleteMessage: "11/13 Setting up inbound networking\n\n",
  //       });
  //     } catch {
  //       return 1;
  //     }

  //     if (!setupInboundNetworkingComplete) {
  //       try {
  //         await setupInboundNetworking({
  //           configPath,
  //           context: this.context,
  //           verbose: this.verbose,
  //         });
  //       } catch (error) {
  //         writeErrorToDebugFile({
  //           context: this.context,
  //           error,
  //         });
  //         this.context.stderr.write(
  //           pc.red(
  //             `Error setting up the inbound networking: ${JSON.stringify(error, null, 2)}\n`
  //           )
  //         );
  //         printHelpInformation(this.context);
  //         backgroundProcessIds.forEach((pid) => {
  //           try {
  //             process.kill(pid);
  //           } catch {
  //             // Do nothing as it's already dead
  //           }
  //         });
  //         return 1;
  //       }

  //       await updateConfigFile({
  //         updates: {
  //           inboundNetworking: true,
  //         },
  //         configPath,
  //         context: this.context,
  //       });
  //     }

  //     let setupMaintenanceControllersComplete = false;
  //     try {
  //       setupMaintenanceControllersComplete = await checkStepCompletion({
  //         configFilePath: configPath,
  //         context: this.context,
  //         step: "maintenanceControllers",
  //         stepCompleteMessage:
  //           "12/13 Skipping maintenance controllers setup as it's already complete.\n",
  //         stepNotCompleteMessage: "12/13 Setting up maintenance controllers\n\n",
  //       });
  //     } catch {
  //       return 1;
  //     }

  //     if (!setupMaintenanceControllersComplete) {
  //       try {
  //         await setupMaintenanceControllers({
  //           configPath,
  //           context: this.context,
  //           verbose: this.verbose,
  //         });
  //       } catch (error) {
  //         writeErrorToDebugFile({
  //           context: this.context,
  //           error: `Error setting up the maintenance controllers: ${JSON.stringify(error, null, 2)}`,
  //         });
  //         this.context.stderr.write(
  //           pc.red(
  //             `Error setting up the maintenance controllers: ${JSON.stringify(error, null, 2)}\n`
  //           )
  //         );
  //         printHelpInformation(this.context);
  //         return 1;
  //       }

  //       await updateConfigFile({
  //         updates: {
  //           maintenanceControllers: true,
  //         },
  //         configPath,
  //         context: this.context,
  //       });
  //     }

  //     let setupCloudNativePGComplete = false;
  //     try {
  //       setupCloudNativePGComplete = await checkStepCompletion({
  //         configFilePath: configPath,
  //         context: this.context,
  //         step: "cloudNativePG",
  //         stepCompleteMessage:
  //           "13/13 Skipping CloudNativePG setup as it's already complete.\n",
  //         stepNotCompleteMessage: "13/13 Setting up CloudNativePG\n\n",
  //       });
  //     } catch {
  //       return 1;
  //     }

  //     if (!setupCloudNativePGComplete) {
  //       try {
  //         await setupCloudNativePG({
  //           context: this.context,
  //           verbose: this.verbose,
  //         });
  //       } catch (error) {
  //         writeErrorToDebugFile({
  //           context: this.context,
  //           error,
  //         });
  //         this.context.stderr.write(
  //           pc.red(
  //             `Error setting up the CloudNativePG: ${JSON.stringify(error, null, 2)}\n`
  //           )
  //         );
  //         printHelpInformation(this.context);
  //         return 1;
  //       }

  //       await updateConfigFile({
  //         updates: {
  //           cloudNativePG: true,
  //         },
  //         configPath,
  //         context: this.context,
  //       });
  //     }

  //     // Verify connection to the cluster
  //     // https://panfactum.com/docs/edge/guides/bootstrapping/kubernetes-cluster#verify-connection
  //     this.context.stdout.write(
  //       pc.green(
  //         "\n🎉 Congrats! You've successfully deployed a Kubernetes cluster using Panfactum! 🎉\n\n"
  //       ) +
  //       pc.blue(
  //         "Run: " +
  //         pc.bold(pc.cyan("kubectl cluster-info\n\n")) +
  //         "You should receive a response similar to the following:\n\n"
  //       ) +
  //       "Kubernetes control plane is running at https://99DF0D231CAEFBDA815F2D8F26575FB6.gr7.us-east-2.eks.amazonaws.com\n" +
  //       "CoreDNS is running at https://99DF0D231CAEFBDA815F2D8F26575FB6.gr7.us-east-2.eks.amazonaws.com/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy\n\n" +
  //       pc.blue(
  //         "The Panfactum devShell ships with a TUI called k9s.\n" +
  //         "To verify what pods are running in the cluster do the following:\n" +
  //         `1. Run ${pc.bold(pc.cyan("k9s"))}.\n` +
  //         `2. Type ${pc.bold(pc.cyan("':pods⏎'"))} to list all the pods in the cluster.\n` +
  //         `3. k9s will filter results by namespace and by default it is set to the default namespace. Press ${pc.bold(pc.cyan("'0'"))} to switch the filter to all namespaces.\n` +
  //         `4. You should see a minimal list of pods running in the cluster\n` +
  //         `5. If you don't see any pods, please reach out to us on Discord\n` +
  //         `6. Type ${pc.bold(pc.cyan("':exit⏎'"))} when ready to exit k9s.\n\n`
  //       )
  //     );

  //     return 0;
  //   }
  // }
}
