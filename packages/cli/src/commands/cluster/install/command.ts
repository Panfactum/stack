import path, { join } from "node:path";
import { Glob } from "bun";
import { Command } from "clipanion";
import { Listr } from "listr2";
import pc from "picocolors";
import { z } from "zod";
import { PanfactumCommand } from "@/util/command/panfactumCommand";
import { SUBDOMAIN } from "@/util/config/schemas";
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
import type { PanfactumTaskWrapper } from "@/util/listr/types";

const SETUP_STEPS: Array<{
  label: string;
  id: string;
  setup: (
    options: InstallClusterStepOptions,
    mainTask: PanfactumTaskWrapper
  ) => Promise<Listr>;
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
    this.context.logger.info("Starting Panfactum cluster installation process")

    /*******************************************
     * Config Loading + Checks
     *
     * Loads the configuration necessary for the installation process
     *******************************************/
    const config = await getPanfactumConfig({
      context: this.context,
      directory: process.cwd(),
    });

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
      const ancestorDomain: string = await this.context.logger.select({
        explainer: {
          message: `Every cluster must have a unique domain name. It must be under one of the domains you've already added to the ${environment} environment.`,
          highlights: [environment]
        },
        message: "Environment domain:",
        choices: Object.keys(domains).map(domain => ({ value: domain, name: domain })),
      });

      const subdomain = await this.context.logger.input({
        explainer: { message: `Choose the subdomain of ${ancestorDomain} the cluster where all cluster utilities will be hosted"`, highlights: [ancestorDomain] },
        message: "Subdomain:",
        default: region,
        validate: async (value) => {
          const { error } = SUBDOMAIN.safeParse(value);
          if (error) {
            return error.issues[0]?.message ?? "Invalid subdomain";
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
              if (yamlContent && yamlContent.kube_domain === `${value}.${ancestorDomain}`) {
                return `Domain ${value}.${ancestorDomain} is already used by another cluster`;
              }
            }
          } catch (error) {
            this.context.logger.debug(`Error checking existing domains: ${JSON.stringify(error, null, 2)}`);
            // Continue even if there's an error reading files
          }

          return true;
        },
        required: true,
      })

      await upsertConfigValues({
        filePath: join(clusterPath, "region.yaml"),
        values: {
          kube_domain: `${subdomain}.${ancestorDomain}`,
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

    const tasks = new Listr([]);

    const options: InstallClusterStepOptions = {
      awsProfile,
      context: this.context,
      environment,
      domains,
      environmentPath,
      kubeConfigContext,
      region,
      clusterPath,
      slaTarget: confirmedSLATarget
    };

    for (const [_, { setup, label, completed }] of SETUP_STEPS.entries()) {
      tasks.add({
        title: this.context.logger.applyColors(`${label} ${completed ? "(skipped)" : ""}`, { lowlights: ["(skipped)"] }),
        skip: () => completed,
        task: async (_, mainTask) => {
          return setup(options, mainTask);
        }
      });
    }

    try {
      await tasks.run();
    } catch (e) {
      killAllBackgroundProcesses({ context: this.context });
      throw new CLIError("Failed to Install Cluster", e);
    }

    // TODO: @seth - interpolate actual cluster name
    this.context.logger.success("🎉 Congrats! You've successfully deployed a Kubernetes cluster using Panfactum! 🎉")
    this.context.logger.info(`
        The Panfactum devShell ships with a TUI called k9s.
        To verify what pods are running in the cluster do the following:
          1. Run ${pc.bold(pc.cyan("k9s"))}
          2. Type ${pc.bold(pc.cyan("':ctx⏎'"))} to list all your installed clusters and select the one that was just installed.
          3. Type ${pc.bold(pc.cyan("':pods⏎'"))} to list all the pods in the cluster.
          4. k9s will filter results by namespace and by default it is set to the default namespace. Press ${pc.bold(pc.cyan("'0'"))} to switch the filter to all namespaces.
          5. You should see a minimal list of pods running in the cluster.
          6. If you don't see any pods, please reach out to us on Discord.
          7. Type ${pc.bold(pc.cyan("':exit⏎'"))} when ready to exit k9s.
    `)

    this.context.logger.warn(`
      The Vault recovery keys and root token have been encrypted and saved in the kube_vault folder.
      The root token allows root access to the vault instance and thus all infrastructure.
      These keys ${pc.bold("SHOULD NOT")} be left here as they will allow for privilege escalation.
      Decide how your organization recommends superusers store these keys.
      This should ${pc.bold("NOT")} be in a location that is accessible by all superusers (e.g. a company password vault).
    `)
  }
}
