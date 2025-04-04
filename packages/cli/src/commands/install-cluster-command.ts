import { appendFileSync } from "node:fs";
import path from "node:path";
import { Command, Option } from "clipanion";
import pc from "picocolors";
import { awsRegions } from "../util/aws-regions";
import { findPanfactumYaml } from "../util/find-panfactum-yaml";
import { printHelpInformation } from "../util/print-help-information";
import { setupEcrPullThroughCache } from "./aws/ecr-pull-through-cache";
import { setupEks } from "./aws/eks";
import { setupVpc } from "./aws/vpc";
import { certManagerPrompts } from "../user-prompts/cert-manager";
import { ecrPullThroughCachePrompts } from "../user-prompts/ecr-pull-through-cache";
import { kubernetesClusterPrompts } from "../user-prompts/kubernetes-cluster";
import { slaPrompts } from "../user-prompts/sla";
import { vpcPrompts } from "../user-prompts/vpc";
import { getConfigFileKey } from "../util/get-config-file-key";
import { replaceYamlValue } from "../util/replace-yaml-value";
import { safeFileExists } from "../util/safe-file-exists";
import { setupAutoscaling } from "./kube/autoscaling";
import { setupCSIDrivers } from "./kube/csi-drivers";
import { setupInboundNetworking } from "./kube/inbound-networking";
import { getTerragruntVariables } from "../util/scripts/get-terragrunt-variables";
import { updateConfigFile } from "../util/update-config-file";
import { setupInternalClusterNetworking } from "./kube/internal-cluster-networking";
import { setupPolicyController } from "./kube/policy-controller";
import { setupVault } from "./kube/vault";
import { vaultPrompts } from "../user-prompts/vault";
import { backgroundProcessIds } from "../util/start-background-process";
import { setupCertManagement } from "./kube/cert-management";
import { setupLinkerd } from "./kube/linkerd";
import { setupMaintenanceControllers } from "./kube/maintenance-controllers";
import { setupCloudNativePG } from "./kube/postgres";
import { generateProgressString } from "../util/generate-progress-string";
import { writeErrorToDebugFile } from "../util/write-error-to-debug-file";

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
        error: `Error writing sla_target to environment.yaml: ${JSON.stringify(error, null, 2)}`,
      });
      this.context.stderr.write(
        pc.red(
          `Error writing sla_target to environment.yaml: ${JSON.stringify(error, null, 2)}\n`
        )
      );
      printHelpInformation(this.context);
      return 1;
    }

    const vpcSetupComplete = await getConfigFileKey({
      key: "setupVpc",
      configPath,
      context: this.context,
    });

    if (vpcSetupComplete === true) {
      this.context.stdout.write(
        "1/13 Skipping VPC setup as it's already complete.\n"
      );
    } else {
      this.context.stdout.write(pc.blue("1/13 Setting up the AWS VPC\n\n"));

      const { vpcName, vpcDescription } = await vpcPrompts({
        environment,
      });

      await updateConfigFile({
        updates: {
          vpcName,
          vpcDescription,
        },
        configPath,
        context: this.context,
      });

      try {
        await setupVpc({
          context: this.context,
          vpcName,
          vpcDescription,
          verbose: this.verbose,
        });
      } catch (error) {
        writeErrorToDebugFile({
          context: this.context,
          error: `Error setting up the AWS VPC: ${JSON.stringify(error, null, 2)}`,
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

    this.context.stdout.write(
      generateProgressString({
        completedSteps: 1,
        totalSteps: 13,
      })
    );

    const setupEcrPullThroughCacheComplete = await getConfigFileKey({
      key: "setupEcrPullThroughCache",
      configPath,
      context: this.context,
    });

    if (setupEcrPullThroughCacheComplete === true) {
      this.context.stdout.write(
        "2/13 Skipping ECR pull through cache setup as it's already complete.\n"
      );
    } else {
      this.context.stdout.write(
        pc.blue("2/13 Setting up the AWS ECR pull through cache\n\n")
      );

      const { dockerHubUsername, githubUsername } =
        await ecrPullThroughCachePrompts({
          context: this.context,
        });

      await updateConfigFile({
        updates: {
          dockerHubUsername,
          githubUsername,
        },
        configPath,
        context: this.context,
      });

      try {
        await setupEcrPullThroughCache({
          context: this.context,
          dockerHubUsername,
          githubUsername,
          verbose: this.verbose,
        });
      } catch (error) {
        writeErrorToDebugFile({
          context: this.context,
          error: `Error setting up the AWS ECR pull through cache: ${JSON.stringify(error, null, 2)}`,
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
          error: `Error updating region.yaml to enable the AWS ECR pull through cache: ${JSON.stringify(error, null, 2)}`,
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

    this.context.stdout.write(
      generateProgressString({
        completedSteps: 2,
        totalSteps: 13,
      })
    );

    const setupEksComplete = await getConfigFileKey({
      key: "setupEks",
      configPath,
      context: this.context,
    });

    if (setupEksComplete === true) {
      this.context.stdout.write(
        "3/13 Skipping EKS cluster setup as it's already complete.\n"
      );
    } else {
      this.context.stdout.write(
        pc.blue("3/13 Setting up the AWS EKS cluster\n\n")
      );
      this.context.stdout.write(
        pc.red(
          pc.bold(
            "⏰ NOTE: The cluster may take up to 20 minutes to be created after you answer a couple questions\n"
          )
        )
      );

      const { clusterName, clusterDescription } =
        await kubernetesClusterPrompts({
          environment,
        });

      await updateConfigFile({
        updates: {
          clusterName,
          clusterDescription,
        },
        configPath,
        context: this.context,
      });

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
          error: `Error setting up the AWS EKS cluster: ${JSON.stringify(error, null, 2)}`,
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

    this.context.stdout.write(
      generateProgressString({
        completedSteps: 3,
        totalSteps: 13,
      })
    );

    const setupInternalClusterNetworkingComplete = await getConfigFileKey({
      key: "internalClusterNetworking",
      configPath,
      context: this.context,
    });

    if (setupInternalClusterNetworkingComplete === true) {
      this.context.stdout.write(
        "4/13 Skipping internal cluster networking setup as it's already complete.\n"
      );
    } else {
      this.context.stdout.write(
        pc.blue("4/13 Setting up the internal cluster networking\n\n")
      );

      try {
        await setupInternalClusterNetworking({
          context: this.context,
          verbose: this.verbose,
        });
        } catch (error) {
        writeErrorToDebugFile({
          context: this.context,
          error: `Error setting up the internal cluster networking: ${JSON.stringify(error, null, 2)}`,
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

    this.context.stdout.write(
      generateProgressString({
        completedSteps: 4,
        totalSteps: 13,
      })
    );

    const setupPolicyControllerComplete = await getConfigFileKey({
      key: "policyController",
      configPath,
      context: this.context,
    });

    if (setupPolicyControllerComplete === true) {
      this.context.stdout.write(
        "5/13 Skipping policy controller setup as it's already complete.\n"
      );
    } else {
      this.context.stdout.write(
        pc.blue("5/13 Setting up the policy controller\n\n")
      );

      try {
        await setupPolicyController({
          context: this.context,
          verbose: this.verbose,
        });
      } catch (error) {
        writeErrorToDebugFile({
          context: this.context,
          error: `Error setting up the policy controller: ${JSON.stringify(error, null, 2)}`,
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

    this.context.stdout.write(
      generateProgressString({
        completedSteps: 5,
        totalSteps: 13,
      })
    );

    const setupCSIDriversComplete = await getConfigFileKey({
      key: "csiDrivers",
      configPath,
      context: this.context,
    });

    if (setupCSIDriversComplete === true) {
      this.context.stdout.write(
        "6/13 Skipping CSI drivers setup as it's already complete.\n"
      );
    } else {
      this.context.stdout.write(
        pc.blue(
          "6/13 Setting up the Container Storage Interface (CSI) drivers\n\n"
        )
      );

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

    this.context.stdout.write(
      generateProgressString({
        completedSteps: 6,
        totalSteps: 13,
      })
    );

    const setupVaultComplete = await getConfigFileKey({
      key: "vault",
      configPath,
      context: this.context,
    });

    if (setupVaultComplete === true) {
      this.context.stdout.write(
        "7/13 Skipping Vault setup as it's already complete.\n"
      );
    } else {
      this.context.stdout.write(pc.blue("7/13 Setting up Vault\n\n"));

      this.context.stdout.write(
        pc.blue(
          "Vault serves several important purposes in the Panfactum framework:\n" +
            "1. Acts as the root certificate authority for each environment’s X.509 certificate infrastructure\n" +
            "2. Authorizes SSH authentication to our bastion hosts\n" +
            "3. Provisions (and de-provisions) dynamic credentials for the framework’s supported databases\n"
        )
      );

      const { vaultDomain } = await vaultPrompts();

      try {
        await setupVault({
          context: this.context,
          vaultDomain,
          verbose: this.verbose,
        });
      } catch (error) {
        writeErrorToDebugFile({
          context: this.context,
          error: `Error setting up the Vault: ${JSON.stringify(error, null, 2)}`,
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
          vaultDomain,
          vault: true,
        },
        configPath,
        context: this.context,
      });
    }

    this.context.stdout.write(
      generateProgressString({
        completedSteps: 7,
        totalSteps: 13,
      })
    );

    const setupCertManagementComplete = await getConfigFileKey({
      key: "certManagement",
      configPath,
      context: this.context,
    });

    if (setupCertManagementComplete === true) {
      this.context.stdout.write(
        "8/13 Skipping certificate management setup as it's already complete.\n"
      );
    } else {
      this.context.stdout.write(
        pc.blue("8/13 Setting up certificate management\n\n")
      );

      const { alertEmail } = await certManagerPrompts();

      try {
        await setupCertManagement({
          context: this.context,
          alertEmail,
          verbose: this.verbose,
        });
      } catch (error) {
        writeErrorToDebugFile({
          context: this.context,
          error: `Error setting up the certificate management: ${JSON.stringify(error, null, 2)}`,
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
          alertEmail,
          certManagement: true,
        },
        configPath,
        context: this.context,
      });
    }

    this.context.stdout.write(
      generateProgressString({
        completedSteps: 8,
        totalSteps: 13,
      })
    );

    const setupServiceMeshComplete = await getConfigFileKey({
      key: "serviceMesh",
      configPath,
      context: this.context,
    });

    if (setupServiceMeshComplete === true) {
      this.context.stdout.write(
        "9/13 Skipping service mesh setup as it's already complete.\n"
      );
    } else {
      this.context.stdout.write(
        pc.blue("9/13 Setting up the service mesh\n\n")
      );

      try {
        await setupLinkerd({
          context: this.context,
          verbose: this.verbose,
        });
      } catch (error) {
        writeErrorToDebugFile({
          context: this.context,
          error: `Error setting up the service mesh: ${JSON.stringify(error, null, 2)}`,
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

    this.context.stdout.write(
      generateProgressString({
        completedSteps: 9,
        totalSteps: 13,
      })
    );

    const setupAutoscalingComplete = await getConfigFileKey({
      key: "autoscaling",
      configPath,
      context: this.context,
    });

    if (setupAutoscalingComplete === true) {
      this.context.stdout.write(
        "10/13 Skipping autoscaling setup as it's already complete.\n"
      );
    } else {
      this.context.stdout.write(pc.blue("10/13 Setting up autoscaling\n\n"));

      try {
        await setupAutoscaling({
          context: this.context,
          verbose: this.verbose,
        });
      } catch (error) {
        writeErrorToDebugFile({
          context: this.context,
          error: `Error setting up the autoscaling: ${JSON.stringify(error, null, 2)}`,
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

    this.context.stdout.write(
      generateProgressString({
        completedSteps: 10,
        totalSteps: 13,
      })
    );

    const setupInboundNetworkingComplete = await getConfigFileKey({
      key: "inboundNetworking",
      configPath,
      context: this.context,
    });

    if (setupInboundNetworkingComplete === true) {
      this.context.stdout.write(
        "11/13 Skipping inbound networking setup as it's already complete.\n"
      );
    } else {
      this.context.stdout.write(
        pc.blue("11/13 Setting up inbound networking\n\n")
      );

      try {
        await setupInboundNetworking({
          configPath,
          context: this.context,
          verbose: this.verbose,
        });
      } catch (error) {
        writeErrorToDebugFile({
          context: this.context,
          error: `Error setting up the inbound networking: ${JSON.stringify(error, null, 2)}`,
        });
        this.context.stderr.write(
          pc.red(
            `Error setting up the inbound networking: ${JSON.stringify(error, null, 2)}\n`
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
          inboundNetworking: true,
        },
        configPath,
        context: this.context,
      });
    }

    this.context.stdout.write(
      generateProgressString({
        completedSteps: 11,
        totalSteps: 13,
      })
    );

    const setupMaintenanceControllersComplete = await getConfigFileKey({
      key: "maintenanceControllers",
      configPath,
      context: this.context,
    });

    if (setupMaintenanceControllersComplete === true) {
      this.context.stdout.write(
        "12/13 Skipping maintenance controllers setup as it's already complete.\n"
      );
    } else {
      this.context.stdout.write(
        pc.blue("12/13 Setting up maintenance controllers\n\n")
      );

      try {
        await setupMaintenanceControllers({
          context: this.context,
          verbose: this.verbose,
        });
      } catch (error) {
        writeErrorToDebugFile({
          context: this.context,
          error: `Error setting up the maintenance controllers: ${JSON.stringify(error, null, 2)}`,
        });
        this.context.stderr.write(
          pc.red(
            `Error setting up the maintenance controllers: ${JSON.stringify(error, null, 2)}\n`
          )
        );
        printHelpInformation(this.context);
        return 1;
      }

      await updateConfigFile({
        updates: {
          maintenanceControllers: true,
        },
        configPath,
        context: this.context,
      });
    }

    this.context.stdout.write(
      generateProgressString({
        completedSteps: 12,
        totalSteps: 13,
      })
    );

    const setupCloudNativePGComplete = await getConfigFileKey({
      key: "cloudNativePG",
      configPath,
      context: this.context,
    });

    if (setupCloudNativePGComplete === true) {
      this.context.stdout.write(
        "13/13 Skipping CloudNativePG setup as it's already complete.\n"
      );
    } else {
      this.context.stdout.write(pc.blue("13/13 Setting up CloudNativePG\n\n"));

      try {
        await setupCloudNativePG({
          context: this.context,
          verbose: this.verbose,
        });
      } catch (error) {
        writeErrorToDebugFile({
          context: this.context,
          error: `Error setting up the CloudNativePG: ${JSON.stringify(error, null, 2)}`,
        });
        this.context.stderr.write(
          pc.red(
            `Error setting up the CloudNativePG: ${JSON.stringify(error, null, 2)}\n`
          )
        );
        printHelpInformation(this.context);
        return 1;
      }

      await updateConfigFile({
        updates: {
          cloudNativePG: true,
        },
        configPath,
        context: this.context,
      });
    }

    this.context.stdout.write(
      generateProgressString({
        completedSteps: 13,
        totalSteps: 13,
      })
    );

    // Verify connection to the cluster
    // https://panfactum.com/docs/edge/guides/bootstrapping/kubernetes-cluster#verify-connection
    this.context.stdout.write(
      pc.green(
        "\n🎉 Congrats! You've successfully deployed a Kubernetes cluster using Panfactum! 🎉\n\n"
      ) +
        pc.blue(
          "Run: " +
            pc.bold(pc.cyan("kubectl cluster-info\n\n")) +
            "You should receive a response similar to the following:\n\n"
        ) +
        "Kubernetes control plane is running at https://99DF0D231CAEFBDA815F2D8F26575FB6.gr7.us-east-2.eks.amazonaws.com\n" +
        "CoreDNS is running at https://99DF0D231CAEFBDA815F2D8F26575FB6.gr7.us-east-2.eks.amazonaws.com/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy\n\n" +
        pc.blue(
          "The Panfactum devShell ships with a TUI called k9s.\n" +
            "To verify what pods are running in the cluster do the following:\n" +
            `1. Run ${pc.bold(pc.cyan("k9s"))}.\n` +
            `2. Type ${pc.bold(pc.cyan("':pods⏎'"))} to list all the pods in the cluster.\n` +
            `3. k9s will filter results by namespace and by default it is set to the default namespace. Press ${pc.bold(pc.cyan("'0'"))} to switch the filter to all namespaces.\n` +
            `4. You should see a minimal list of pods running in the cluster\n` +
            `5. If you don't see any pods, please reach out to us on Discord\n` +
            `6. Type ${pc.bold(pc.cyan("':exit⏎'"))} when ready to exit k9s.\n\n`
        )
    );

    return 0;
  }
}
