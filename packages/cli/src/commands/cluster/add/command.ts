import path, { join } from "node:path";
import { GetServiceQuotaCommand, ServiceQuotasClient } from "@aws-sdk/client-service-quotas";
import { Glob } from "bun";
import { Command } from "clipanion";
import { Listr } from "listr2";
import pc from "picocolors";
import { z } from "zod";
import { PanfactumCommand } from "@/util/command/panfactumCommand";
import { getPanfactumConfig } from "@/util/config/getPanfactumConfig.ts";
import { SUBDOMAIN } from "@/util/config/schemas";
import { upsertConfigValues } from "@/util/config/upsertConfigValues";
import { CLIError } from "@/util/error/error";
import { killAllBackgroundProcesses } from "@/util/subprocess/killBackgroundProcess";
import { MODULES } from "@/util/terragrunt/constants";
import { getModuleStatus } from "@/util/terragrunt/getModuleStatus";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import { setSLA } from "./setSLA";
import { setupAutoscaling } from "./setupAutoscaling";
import { setupCertificates } from "./setupCertificates";
import { setupClusterExtensions } from "./setupClusterExtensions";
import { setupCSIDrivers } from "./setupCSIDrivers";
import { setupEKS } from "./setupEKS";
import { setupInboundNetworking } from "./setupInboundNetworking";
import { setupInternalClusterNetworking } from "./setupInternalClusterNetworking";
import { setupLinkerd } from "./setupLinkerd";
import { setupPolicyController } from "./setupPolicyController";
import { setupVault } from "./setupVault";
import { setupVPC } from "./setupVPC.ts";
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
      label: "AWS VPC",
      id: "setupVPC",
      setup: setupVPC,
      completed: false,
      lastModule: MODULES.AWS_VPC,
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
      label: "Certificates",
      id: "setupCertificates",
      setup: setupCertificates,
      completed: false,
      lastModule: MODULES.KUBE_CERTIFICATES,
    },
    {
      label: "Linkerd",
      id: "setupLinkerd",
      setup: setupLinkerd,
      completed: false,
      lastModule: MODULES.KUBE_LINKERD,
    },
    {
      label: "Inbound Networking",
      id: "setupInboundNetworking",
      setup: setupInboundNetworking,
      completed: false,
      lastModule: MODULES.KUBE_INGRESS_NGINX,
    },
    {
      label: "Autoscaling",
      id: "setupAutoscaling",
      setup: setupAutoscaling,
      completed: false,
      lastModule: MODULES.KUBE_SCHEDULER,
    },
    {
      label: "Cluster Extensions",
      id: "setupClusterExtensions",
      setup: setupClusterExtensions,
      completed: false,
      lastModule: MODULES.KUBE_RELOADER,
    },
  ];

export class ClusterAddCommand extends PanfactumCommand {
  static override paths = [["cluster", "add"]];

  static override usage = Command.Usage({
    description: "Install a Panfactum cluster",
    details:
      "This command sets up a new Panfactum cluster including collecting configuration options and setting up all standard components.",
    examples: [["Start cluster installation", "pf cluster add"]],
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

    /***********************************************
     * Confirms the vCPU quota is high enough
     ***********************************************/
    const serviceQuotasClient = new ServiceQuotasClient({ region, profile: awsProfile })
    const command = new GetServiceQuotaCommand({
      QuotaCode: "L-1216C47A",
      ServiceCode: "ec2",
    })
    try {
      const quota = await serviceQuotasClient.send(command)
      if (quota.Quota?.Value && quota.Quota.Value < 16) {
        this.context.logger.warn(`The EC2 vCPU quota is too low to install a cluster right now
          If you set this environment up with pf env add then the quota increase has already been requested.
          Check your e-mail for status updates on the request and try again when it has been approved.`)
        return
      }
    } catch (error) {
      throw new CLIError("Error retrieving EC2 vCPU quota.", error)
    }


    /***********************************************
     * Confirms the SLA target for the cluster
     ***********************************************/
    const environmentPath = path.join(
      this.context.repoVariables.environments_dir,
      environment
    );
    const clusterPath = path.join(environmentPath, region);

    const confirmedSLATarget = await setSLA({
      environment,
      region,
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
        explainer: { message: `Choose the subdomain of ${ancestorDomain} for the cluster. All cluster utilities will be hosted under this subdomain.`, highlights: [ancestorDomain] },
        message: "Cluster subdomain:",
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

              // FIX: Need to see if this domain is already taken (even if not by another cluster)

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

    // Check each step and mark as completed if .pf.yaml status is applied
    for (const step of SETUP_STEPS) {
      const pfData = await getModuleStatus({ environment, region, module: step.lastModule, context: this.context });
      if (step.id === "setupCertificates") {
        // Certificates are a special case because the last module is applied twice during the setup process
        const certificatesModuleInfo = await readYAMLFile({
          filePath: join(clusterPath, MODULES.KUBE_CERTIFICATES, "module.yaml"), context: this.context, validationSchema: z.object({
            extra_inputs: z.object({
              self_generated_certs_enabled: z.boolean(),
            }).optional()
          })
        })
        step.completed = pfData.deploy_status === "success" && certificatesModuleInfo?.extra_inputs?.self_generated_certs_enabled === false;
      } else if (step.id === "setupClusterExtensions") {
        // Due to the concurrent nature of this step, we let the step handle it's own completion logic
        step.completed = false;
      } else {
        step.completed = pfData.deploy_status === "success";
      }
    }

    const tasks = new Listr([], { rendererOptions: { collapseErrors: false } });

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

          5. Type ${pc.bold(pc.cyan("':exit⏎'"))} when ready to exit k9s.
    `)

    this.context.logger.warn(`
      The Vault recovery keys have been encrypted and saved in the kube_vault folder in the recovery.yaml file.
      The recovery keys allow root access to the vault instance and thus all infrastructure.
      These keys ${pc.bold("SHOULD NOT")} be left here as they will allow for privilege escalation.
      Decide how your organization recommends superusers store these keys.
      This should ${pc.bold("NOT")} be in a location that is accessible by all superusers (e.g. a company password vault).
    `)
  }
}
