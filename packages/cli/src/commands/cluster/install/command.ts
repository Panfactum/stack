import { appendFileSync } from "node:fs";
import path from "node:path";
import { Command, Option } from "clipanion";
import pc from "picocolors";
import { setupEcrPullThroughCache } from "./aws/ecr-pull-through-cache";
import { setupEks } from "./aws/eks";
import { setupVpc } from "./aws/vpc";
import { setupAutoscaling } from "./kube/autoscaling";
import { setupCertManagement } from "./kube/cert-management";
import { setupCSIDrivers } from "./kube/csi-drivers";
import { setupInboundNetworking } from "./kube/inbound-networking";
import { setupInternalClusterNetworking } from "./kube/internal-cluster-networking";
import { setupLinkerd } from "./kube/linkerd";
import { setupMaintenanceControllers } from "./kube/maintenance-controllers";
import { setupPolicyController } from "./kube/policy-controller";
import { setupCloudNativePG } from "./kube/postgres";
import { setupVault } from "./kube/vault";
import { certManagerPrompts } from "./user-prompts/cert-manager";
import { ecrPullThroughCachePrompts } from "./user-prompts/ecr-pull-through-cache";
import { kubernetesClusterPrompts } from "./user-prompts/kubernetes-cluster";
import { slaPrompts } from "./user-prompts/sla";
import { vaultPrompts } from "./user-prompts/vault";
import { vpcPrompts } from "./user-prompts/vpc";
import { awsRegions } from "../../../util/aws-regions";
import { checkStepCompletion } from "../../../util/check-step-completion";
import { findPanfactumYaml } from "../../../util/find-panfactum-yaml";
import { getConfigFileKey } from "../../../util/get-config-file-key";
import { printHelpInformation } from "../../../util/print-help-information";
import { replaceYamlValue } from "../../../util/replace-yaml-value";
import { safeFileExists } from "../../../util/safe-file-exists";
import { getTerragruntVariables } from "../../../util/scripts/get-terragrunt-variables";
import { backgroundProcessIds } from "../../../util/start-background-process";
import { updateConfigFile } from "../../../util/update-config-file";
import { writeErrorToDebugFile } from "../../../util/write-error-to-debug-file";

export class InstallClusterCommand extends Command {
  static override paths = [["install-cluster"]];

  verbose = Option.Boolean("-v,--verbose", {
    description: "Enable verbose output",
  });

  static override usage = Command.Usage({
    description: "Install a Panfactum cluster",
    details:
      "This command sets up a new Panfactum cluster including collecting configuration options and setting up all standard components.",
    examples: [["Start cluster installation", "pf install-cluster"]],
  });

  // eslint-disable-next-line sonarjs/cognitive-complexity
  async execute(): Promise<number> {
    process.env["PF_SKIP_CHECK_REPO_SETUP"] = "1";
    this.context.stdout.write("██████╗  █████╗ ███╗   ██╗███████╗ █████╗  ██████╗████████╗██╗   ██╗███╗   ███╗\n") // prettier-ignore
    this.context.stdout.write("██╔══██╗██╔══██╗████╗  ██║██╔════╝██╔══██╗██╔════╝╚══██╔══╝██║   ██║████╗ ████║\n") // prettier-ignore
    this.context.stdout.write("██████╔╝███████║██╔██╗ ██║█████╗  ███████║██║        ██║   ██║   ██║██╔████╔██║\n") // prettier-ignore
    this.context.stdout.write("██╔═══╝ ██╔══██║██║╚██╗██║██╔══╝  ██╔══██║██║        ██║   ██║   ██║██║╚██╔╝██║\n") // prettier-ignore
    this.context.stdout.write("██║     ██║  ██║██║ ╚████║██║     ██║  ██║╚██████╗   ██║   ╚██████╔╝██║ ╚═╝ ██║\n") // prettier-ignore
    this.context.stdout.write("╚═╝     ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝     ╚═╝  ╚═╝ ╚═════╝   ╚═╝    ╚═════╝ ╚═╝     ╚═╝\n") // prettier-ignore
    this.context.stdout.write(
      pc.blue(pc.bold("Starting Panfactum cluster installation process\n\n"))
    );

    // Check if they're using the devShell
    if (this.context.env["PF_DEVSHELL"] !== "1") {
      this.context.stderr.write(
        pc.red(
          "ERROR: It appears you're not running this installer in the Panfactum devShell.\n" +
            "Please ensure you've completed the initial setup steps in the guide here:\n" +
            "https://panfactum.com/docs/edge/guides/bootstrapping/installing-devshell#integrate-the-panfactum-devshell\n"
        )
      );
      printHelpInformation(this.context);
      return 1;
    }

    // If there's no panfactum.yaml they need to complete the initial setup steps
    const currentDirectory = process.cwd();
    const panfactumYamlPath = await findPanfactumYaml(currentDirectory);
    if (panfactumYamlPath === null) {
      this.context.stderr.write(
        pc.red(
          "ERROR: Could not find panfactum.yaml in the current directory or any parent directory.\n" +
            "Please ensure you've completed the initial setup steps in the guide here:\n" +
            "https://panfactum.com/docs/edge/guides/bootstrapping/installing-devshell#setting-repository-configuration-variables\n"
        )
      );
      printHelpInformation(this.context);
      return 1;
    }

    const terragruntVariables = await getTerragruntVariables({
      context: this.context,
    });

    this.verbose &&
      this.context.stdout.write(
        `Terragrunt variables: ${JSON.stringify(terragruntVariables, null, 2)}\n`
      );

    const environment = terragruntVariables["environment"];
    const validRegionsPattern = awsRegions.join("|");
    const pathRegex = new RegExp(
      `/${environment}/(${validRegionsPattern})(?:/.*)?$`
    );
    const match = currentDirectory.match(pathRegex);

    if (!match) {
      this.context.stderr.write(
        pc.red(
          "ERROR: Cluster installation must be run from within a valid region-specific directory.\n" +
            `Please change to a directory like ${environment}/<valid-aws-region> before continuing.\n` +
            `Valid AWS regions include: ${awsRegions.slice(0, 3).join(", ")}, and others.\n` +
            "If you do not have this file structure please ensure you've completed the initial setup steps here:\n" +
            "https://panfactum.com/docs/edge/guides/bootstrapping/configuring-infrastructure-as-code#setting-up-your-repo\n"
        )
      );
      printHelpInformation(this.context);
      return 1;
    }

    const terragruntSlaTarget = terragruntVariables["sla_target"];
    let slaTarget: 0 | 1 | 2 | 3 | undefined;
    if (!terragruntSlaTarget) {
      slaTarget = await slaPrompts({
        context: this.context,
        needSlaTarget: true,
      });

      if (slaTarget === 0) {
        return 0;
      }
    }

    // Write configuration to temp file
    const configPath = path.join(
      currentDirectory,
      ".tmp-panfactum-install-config.json"
    );
    const configurationTempFileExists = await safeFileExists(configPath);
    if (!configurationTempFileExists) {
      await Bun.write(
        configPath,
        JSON.stringify(
          {
            slaTarget,
          },
          null,
          2
        )
      );
    }

    try {
      if (!terragruntSlaTarget) {
        // If sla_target doesn't exist, append it to the environment.yaml file
        appendFileSync(
          path.join(currentDirectory, "..", "environment.yaml"),
          `\n\n# SLA\nsla_target: ${slaTarget || terragruntSlaTarget}`
        );
      }
    } catch (error) {
      writeErrorToDebugFile({
        context: this.context,
        error,
      });
      this.context.stderr.write(
        pc.red(
          `Error writing sla_target to environment.yaml: ${JSON.stringify(error, null, 2)}\n`
        )
      );
      printHelpInformation(this.context);
      return 1;
    }

    let vpcSetupComplete = false;
    try {
      vpcSetupComplete = await checkStepCompletion({
        configFilePath: configPath,
        context: this.context,
        step: "setupVpc",
        stepCompleteMessage:
          "1/13 Skipping VPC setup as it's already complete.\n",
        stepNotCompleteMessage: "1/13 Setting up the AWS VPC\n\n",
      });
    } catch {
      return 1;
    }

    if (!vpcSetupComplete) {
      let name = "";
      let description = "";
      const nameConfig = await getConfigFileKey({
        configPath,
        key: "vpcName",
        context: this.context,
      });
      const descriptionConfig = await getConfigFileKey({
        configPath,
        key: "vpcDescription",
        context: this.context,
      });
      if (
        !nameConfig ||
        !descriptionConfig ||
        typeof nameConfig !== "string" ||
        typeof descriptionConfig !== "string"
      ) {
        const { vpcName, vpcDescription } = await vpcPrompts({
          environment,
        });
        name = vpcName;
        description = vpcDescription;
      } else {
        name = nameConfig;
        description = descriptionConfig;
      }

      await updateConfigFile({
        updates: {
          vpcName: name,
          vpcDescription: description,
        },
        configPath,
        context: this.context,
      });

      try {
        await setupVpc({
          configPath,
          context: this.context,
          vpcName: name,
          vpcDescription: description,
          verbose: this.verbose,
        });
      } catch (error) {
        writeErrorToDebugFile({
          context: this.context,
          error,
        });
        this.context.stderr.write(
          pc.red(
            `Error setting up the AWS VPC: ${JSON.stringify(error, null, 2)}\n`
          )
        );
        printHelpInformation(this.context);
        return 1;
      }
    }

    await updateConfigFile({
      updates: {
        setupVpc: true,
      },
      configPath,
      context: this.context,
    });

    let setupEcrPullThroughCacheComplete = false;
    try {
      setupEcrPullThroughCacheComplete = await checkStepCompletion({
        configFilePath: configPath,
        context: this.context,
        step: "setupEcrPullThroughCache",
        stepCompleteMessage:
          "2/13 Skipping ECR pull through cache setup as it's already complete.\n",
        stepNotCompleteMessage:
          "2/13 Setting up the AWS ECR pull through cache\n\n",
      });
    } catch {
      return 1;
    }

    if (!setupEcrPullThroughCacheComplete) {
      let dhUsername = "";
      let ghUsername = "";
      const dhUsernameConfig = await getConfigFileKey({
        configPath,
        key: "dockerHubUsername",
        context: this.context,
      });
      const ghUsernameConfig = await getConfigFileKey({
        configPath,
        key: "githubUsername",
        context: this.context,
      });

      if (
        !dhUsernameConfig ||
        !ghUsernameConfig ||
        typeof dhUsernameConfig !== "string" ||
        typeof ghUsernameConfig !== "string"
      ) {
        const { dockerHubUsername, githubUsername } =
          await ecrPullThroughCachePrompts({
            context: this.context,
          });
        dhUsername = dockerHubUsername;
        ghUsername = githubUsername;
      }

      await updateConfigFile({
        updates: {
          dockerHubUsername: dhUsername,
          githubUsername: ghUsername,
        },
        configPath,
        context: this.context,
      });

      try {
        await setupEcrPullThroughCache({
          context: this.context,
          dockerHubUsername: dhUsername,
          githubUsername: ghUsername,
          verbose: this.verbose,
        });
      } catch (error) {
        writeErrorToDebugFile({
          context: this.context,
          error,
        });
        this.context.stderr.write(
          pc.red(
            `Error setting up the AWS ECR pull through cache: ${JSON.stringify(error, null, 2)}\n`
          )
        );
        printHelpInformation(this.context);
        return 1;
      }

      try {
        await replaceYamlValue(
          "./region.yaml",
          "extra_inputs.pull_through_cache_enabled",
          true
        );
      } catch (error) {
        writeErrorToDebugFile({
          context: this.context,
          error,
        });
        this.context.stderr.write(
          pc.red(
            `Error updating region.yaml to enable the AWS ECR pull through cache: ${JSON.stringify(error, null, 2)}\n`
          )
        );
        printHelpInformation(this.context);
        return 1;
      }

      await updateConfigFile({
        updates: {
          setupEcrPullThroughCache: true,
        },
        configPath,
        context: this.context,
      });
    }

    let setupEksComplete = false;
    try {
      setupEksComplete = await checkStepCompletion({
        configFilePath: configPath,
        context: this.context,
        step: "setupEks",
        stepCompleteMessage:
          "3/13 Skipping EKS cluster setup as it's already complete.\n",
        stepNotCompleteMessage: "3/13 Setting up the AWS EKS cluster\n\n",
      });
    } catch {
      return 1;
    }

    if (!setupEksComplete) {
      this.context.stdout.write(
        pc.red(
          pc.bold(
            "⏰ NOTE: The cluster may take up to 20 minutes to be created after you answer a couple questions\n"
          )
        )
      );

      let clusterName = "";
      let clusterDescription = "";
      const clusterNameConfig = await getConfigFileKey({
        configPath,
        key: "clusterName",
        context: this.context,
      });
      const clusterDescriptionConfig = await getConfigFileKey({
        configPath,
        key: "clusterDescription",
        context: this.context,
      });
      if (
        !clusterNameConfig ||
        typeof clusterNameConfig !== "string" ||
        !clusterDescriptionConfig ||
        typeof clusterDescriptionConfig !== "string"
      ) {
        const {
          clusterName: clusterNameInput,
          clusterDescription: clusterDescriptionInput,
        } = await kubernetesClusterPrompts({
          environment,
        });
        clusterName = clusterNameInput;
        clusterDescription = clusterDescriptionInput;
        await updateConfigFile({
          updates: {
            clusterName,
            clusterDescription,
          },
          configPath,
          context: this.context,
        });
      } else {
        clusterName = clusterNameConfig;
        clusterDescription = clusterDescriptionConfig;
      }

      try {
        await setupEks({
          context: this.context,
          clusterName,
          clusterDescription,
          slaLevel: slaTarget || (terragruntSlaTarget as 1 | 2 | 3), // This is validated in the code earlier
          verbose: this.verbose,
        });
      } catch (error) {
        writeErrorToDebugFile({
          context: this.context,
          error,
        });
        this.context.stderr.write(
          pc.red(
            `Error setting up the AWS EKS cluster: ${JSON.stringify(error, null, 2)}\n`
          )
        );
        printHelpInformation(this.context);
        return 1;
      }

      await updateConfigFile({
        updates: {
          setupEks: true,
        },
        configPath,
        context: this.context,
      });
    }

    let setupInternalClusterNetworkingComplete = false;
    try {
      setupInternalClusterNetworkingComplete = await checkStepCompletion({
        configFilePath: configPath,
        context: this.context,
        step: "internalClusterNetworking",
        stepCompleteMessage:
          "4/13 Skipping internal cluster networking setup as it's already complete.\n",
        stepNotCompleteMessage:
          "4/13 Setting up the internal cluster networking\n\n",
      });
    } catch {
      return 1;
    }

    if (!setupInternalClusterNetworkingComplete) {
      try {
        await setupInternalClusterNetworking({
          configPath,
          context: this.context,
          verbose: this.verbose,
        });
      } catch (error) {
        writeErrorToDebugFile({
          context: this.context,
          error,
        });
        this.context.stderr.write(
          pc.red(
            `Error setting up the internal cluster networking: ${JSON.stringify(error, null, 2)}\n`
          )
        );
        printHelpInformation(this.context);
        return 1;
      }

      await updateConfigFile({
        updates: {
          internalClusterNetworking: true,
        },
        configPath,
        context: this.context,
      });
    }

    let setupPolicyControllerComplete = false;
    try {
      setupPolicyControllerComplete = await checkStepCompletion({
        configFilePath: configPath,
        context: this.context,
        step: "policyController",
        stepCompleteMessage:
          "5/13 Skipping policy controller setup as it's already complete.\n",
        stepNotCompleteMessage: "5/13 Setting up the policy controller\n\n",
      });
    } catch {
      return 1;
    }

    if (!setupPolicyControllerComplete) {
      try {
        await setupPolicyController({
          configPath,
          context: this.context,
          verbose: this.verbose,
        });
      } catch (error) {
        writeErrorToDebugFile({
          context: this.context,
          error,
        });
        this.context.stderr.write(
          pc.red(
            `Error setting up the policy controller: ${JSON.stringify(error, null, 2)}\n`
          )
        );
        printHelpInformation(this.context);
        return 1;
      }

      await updateConfigFile({
        updates: {
          policyController: true,
        },
        configPath,
        context: this.context,
      });
    }

    let setupCSIDriversComplete = false;
    try {
      setupCSIDriversComplete = await checkStepCompletion({
        configFilePath: configPath,
        context: this.context,
        step: "csiDrivers",
        stepCompleteMessage:
          "6/13 Skipping CSI drivers setup as it's already complete.\n",
        stepNotCompleteMessage:
          "6/13 Setting up the Container Storage Interface (CSI) drivers\n\n",
      });
    } catch {
      return 1;
    }

    if (!setupCSIDriversComplete) {
      try {
        await setupCSIDrivers({
          context: this.context,
          verbose: this.verbose,
        });
      } catch (error) {
        writeErrorToDebugFile({
          context: this.context,
          error: `Error setting up the Container Storage Interface (CSI) drivers: ${JSON.stringify(error, null, 2)}`,
        });
        this.context.stderr.write(
          pc.red(
            `Error setting up the Container Storage Interface (CSI) drivers: ${JSON.stringify(error, null, 2)}\n`
          )
        );
        printHelpInformation(this.context);
        return 1;
      }

      await updateConfigFile({
        updates: {
          csiDrivers: true,
        },
        configPath,
        context: this.context,
      });
    }

    let setupVaultComplete = false;
    try {
      setupVaultComplete = await checkStepCompletion({
        configFilePath: configPath,
        context: this.context,
        step: "vault",
        stepCompleteMessage:
          "7/13 Skipping Vault setup as it's already complete.\n",
        stepNotCompleteMessage: "7/13 Setting up Vault\n\n",
      });
    } catch {
      return 1;
    }

    if (!setupVaultComplete) {
      this.context.stdout.write(
        pc.blue(
          "Vault serves several important purposes in the Panfactum framework:\n" +
            "1. Acts as the root certificate authority for each environment’s X.509 certificate infrastructure\n" +
            "2. Authorizes SSH authentication to our bastion hosts\n" +
            "3. Provisions (and de-provisions) dynamic credentials for the framework’s supported databases\n"
        )
      );

      let domain = "";
      const vaultDomainConfig = await getConfigFileKey({
        configPath,
        key: "vaultDomain",
        context: this.context,
      });
      if (!vaultDomainConfig || typeof vaultDomainConfig !== "string") {
        const { vaultDomain } = await vaultPrompts();
        domain = vaultDomain;
        await updateConfigFile({
          updates: {
            vaultDomain,
          },
          configPath,
          context: this.context,
        });
      } else {
        domain = vaultDomainConfig;
      }

      try {
        await setupVault({
          configPath,
          context: this.context,
          vaultDomain: domain,
          verbose: this.verbose,
        });
      } catch (error) {
        writeErrorToDebugFile({
          context: this.context,
          error,
        });
        this.context.stderr.write(
          pc.red(
            `Error setting up the Vault: ${JSON.stringify(error, null, 2)}\n`
          )
        );
        printHelpInformation(this.context);
        backgroundProcessIds.forEach((pid) => {
          try {
            process.kill(pid);
          } catch {
            // Do nothing as it's already dead
          }
        });
        return 1;
      }

      await updateConfigFile({
        updates: {
          vault: true,
        },
        configPath,
        context: this.context,
      });
    }

    let setupCertManagementComplete = false;
    try {
      setupCertManagementComplete = await checkStepCompletion({
        configFilePath: configPath,
        context: this.context,
        step: "certManagement",
        stepCompleteMessage:
          "8/13 Skipping certificate management setup as it's already complete.\n",
        stepNotCompleteMessage: "8/13 Setting up certificate management\n\n",
      });
    } catch {
      return 1;
    }

    if (!setupCertManagementComplete) {
      let alertEmail = "";
      const alertEmailConfig = await getConfigFileKey({
        configPath,
        key: "alertEmail",
        context: this.context,
      });
      if (!alertEmailConfig || typeof alertEmailConfig !== "string") {
        const { alertEmail: alertEmailInput } = await certManagerPrompts();
        await updateConfigFile({
          updates: {
            alertEmail: alertEmailInput,
          },
          configPath,
          context: this.context,
        });
        alertEmail = alertEmailInput;
      } else {
        alertEmail = alertEmailConfig;
      }

      try {
        await setupCertManagement({
          configPath,
          context: this.context,
          alertEmail,
          verbose: this.verbose,
        });
      } catch (error) {
        writeErrorToDebugFile({
          context: this.context,
          error,
        });
        this.context.stderr.write(
          pc.red(
            `Error setting up certificate management: ${JSON.stringify(error, null, 2)}\n`
          )
        );
        printHelpInformation(this.context);
        backgroundProcessIds.forEach((pid) => {
          try {
            process.kill(pid);
          } catch {
            // Do nothing as it's already dead
          }
        });
        return 1;
      }

      await updateConfigFile({
        updates: {
          certManagement: true,
        },
        configPath,
        context: this.context,
      });
    }

    let setupServiceMeshComplete = false;
    try {
      setupServiceMeshComplete = await checkStepCompletion({
        configFilePath: configPath,
        context: this.context,
        step: "serviceMesh",
        stepCompleteMessage:
          "9/13 Skipping service mesh setup as it's already complete.\n",
        stepNotCompleteMessage: "9/13 Setting up the service mesh\n\n",
      });
    } catch {
      return 1;
    }

    if (!setupServiceMeshComplete) {
      try {
        await setupLinkerd({
          configPath,
          context: this.context,
          verbose: this.verbose,
        });
      } catch (error) {
        writeErrorToDebugFile({
          context: this.context,
          error,
        });
        this.context.stderr.write(
          pc.red(
            `Error setting up the service mesh: ${JSON.stringify(error, null, 2)}\n`
          )
        );
        printHelpInformation(this.context);
        backgroundProcessIds.forEach((pid) => {
          try {
            process.kill(pid);
          } catch {
            // Do nothing as it's already dead
          }
        });
        return 1;
      }

      await updateConfigFile({
        updates: {
          serviceMesh: true,
        },
        configPath,
        context: this.context,
      });
    }

    let setupAutoscalingComplete = false;
    try {
      setupAutoscalingComplete = await checkStepCompletion({
        configFilePath: configPath,
        context: this.context,
        step: "autoscaling",
        stepCompleteMessage:
          "10/13 Skipping autoscaling setup as it's already complete.\n",
        stepNotCompleteMessage: "10/13 Setting up autoscaling\n\n",
      });
    } catch {
      return 1;
    }

    if (!setupAutoscalingComplete) {
      try {
        await setupAutoscaling({
          configPath,
          context: this.context,
          verbose: this.verbose,
        });
      } catch (error) {
        writeErrorToDebugFile({
          context: this.context,
          error,
        });
        this.context.stderr.write(
          pc.red(
            `Error setting up the autoscaling: ${JSON.stringify(error, null, 2)}\n`
          )
        );
        printHelpInformation(this.context);
        backgroundProcessIds.forEach((pid) => {
          try {
            process.kill(pid);
          } catch {
            // Do nothing as it's already dead
          }
        });
        return 1;
      }

      await updateConfigFile({
        updates: {
          autoscaling: true,
        },
        configPath,
        context: this.context,
      });
    }

    // let setupInboundNetworkingComplete = false;
    // try {
    //   setupInboundNetworkingComplete = await checkStepCompletion({
    //     configFilePath: configPath,
    //     context: this.context,
    //     step: "inboundNetworking",
    //     stepCompleteMessage:
    //       "11/13 Skipping inbound networking setup as it's already complete.\n",
    //     stepNotCompleteMessage: "11/13 Setting up inbound networking\n\n",
    //   });
    // } catch {
    //   return 1;
    // }

    // if (!setupInboundNetworkingComplete) {
    //   try {
    //     await setupInboundNetworking({
    //       configPath,
    //       context: this.context,
    //       verbose: this.verbose,
    //     });
    //   } catch (error) {
    //     writeErrorToDebugFile({
    //       context: this.context,
    //       error: `Error setting up the inbound networking: ${JSON.stringify(error, null, 2)}`,
    //     });
    //     this.context.stderr.write(
    //       pc.red(
    //         `Error setting up the inbound networking: ${JSON.stringify(error, null, 2)}\n`
    //       )
    //     );
    //     printHelpInformation(this.context);
    //     backgroundProcessIds.forEach((pid) => {
    //       try {
    //         process.kill(pid);
    //       } catch {
    //         // Do nothing as it's already dead
    //       }
    //     });
    //     return 1;
    //   }

    //   await updateConfigFile({
    //     updates: {
    //       inboundNetworking: true,
    //     },
    //     configPath,
    //     context: this.context,
    //   });
    // }

    // let setupMaintenanceControllersComplete = false;
    // try {
    //   setupMaintenanceControllersComplete = await checkStepCompletion({
    //     configFilePath: configPath,
    //     context: this.context,
    //     step: "maintenanceControllers",
    //     stepCompleteMessage:
    //       "12/13 Skipping maintenance controllers setup as it's already complete.\n",
    //     stepNotCompleteMessage: "12/13 Setting up maintenance controllers\n\n",
    //   });
    // } catch {
    //   return 1;
    // }

    // if (!setupMaintenanceControllersComplete) {
    //   try {
    //     await setupMaintenanceControllers({
    //       context: this.context,
    //       verbose: this.verbose,
    //     });
    //   } catch (error) {
    //     writeErrorToDebugFile({
    //       context: this.context,
    //       error: `Error setting up the maintenance controllers: ${JSON.stringify(error, null, 2)}`,
    //     });
    //     this.context.stderr.write(
    //       pc.red(
    //         `Error setting up the maintenance controllers: ${JSON.stringify(error, null, 2)}\n`
    //       )
    //     );
    //     printHelpInformation(this.context);
    //     return 1;
    //   }

    //   await updateConfigFile({
    //     updates: {
    //       maintenanceControllers: true,
    //     },
    //     configPath,
    //     context: this.context,
    //   });
    // }

    // let setupCloudNativePGComplete = false;
    // try {
    //   setupCloudNativePGComplete = await checkStepCompletion({
    //     configFilePath: configPath,
    //     context: this.context,
    //     step: "cloudNativePG",
    //     stepCompleteMessage:
    //       "13/13 Skipping CloudNativePG setup as it's already complete.\n",
    //     stepNotCompleteMessage: "13/13 Setting up CloudNativePG\n\n",
    //   });
    // } catch {
    //   return 1;
    // }

    // if (!setupCloudNativePGComplete) {
    //   try {
    //     await setupCloudNativePG({
    //       context: this.context,
    //       verbose: this.verbose,
    //     });
    //   } catch (error) {
    //     writeErrorToDebugFile({
    //       context: this.context,
    //       error: `Error setting up the CloudNativePG: ${JSON.stringify(error, null, 2)}`,
    //     });
    //     this.context.stderr.write(
    //       pc.red(
    //         `Error setting up the CloudNativePG: ${JSON.stringify(error, null, 2)}\n`
    //       )
    //     );
    //     printHelpInformation(this.context);
    //     return 1;
    //   }

    //   await updateConfigFile({
    //     updates: {
    //       cloudNativePG: true,
    //     },
    //     configPath,
    //     context: this.context,
    //   });
    // }

    // // Verify connection to the cluster
    // // https://panfactum.com/docs/edge/guides/bootstrapping/kubernetes-cluster#verify-connection
    // this.context.stdout.write(
    //   pc.green(
    //     "\n🎉 Congrats! You've successfully deployed a Kubernetes cluster using Panfactum! 🎉\n\n"
    //   ) +
    //     pc.blue(
    //       "Run: " +
    //         pc.bold(pc.cyan("kubectl cluster-info\n\n")) +
    //         "You should receive a response similar to the following:\n\n"
    //     ) +
    //     "Kubernetes control plane is running at https://99DF0D231CAEFBDA815F2D8F26575FB6.gr7.us-east-2.eks.amazonaws.com\n" +
    //     "CoreDNS is running at https://99DF0D231CAEFBDA815F2D8F26575FB6.gr7.us-east-2.eks.amazonaws.com/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy\n\n" +
    //     pc.blue(
    //       "The Panfactum devShell ships with a TUI called k9s.\n" +
    //         "To verify what pods are running in the cluster do the following:\n" +
    //         `1. Run ${pc.bold(pc.cyan("k9s"))}.\n` +
    //         `2. Type ${pc.bold(pc.cyan("':pods⏎'"))} to list all the pods in the cluster.\n` +
    //         `3. k9s will filter results by namespace and by default it is set to the default namespace. Press ${pc.bold(pc.cyan("'0'"))} to switch the filter to all namespaces.\n` +
    //         `4. You should see a minimal list of pods running in the cluster\n` +
    //         `5. If you don't see any pods, please reach out to us on Discord\n` +
    //         `6. Type ${pc.bold(pc.cyan("':exit⏎'"))} when ready to exit k9s.\n\n`
    //     )
    // );

    return 0;
  }
}
