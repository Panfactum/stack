// This file defines the sso add command for installing Authentik SSO
// It sets up single sign-on infrastructure with federated authentication

import { join } from "node:path";
import { Command } from "clipanion";
import { Listr } from "listr2";
import { z } from "zod";
import { PanfactumCommand } from "@/util/command/panfactumCommand";
import {getEnvironments} from "@/util/config/getEnvironments.ts";
import {getRegions} from "@/util/config/getRegions.ts";
import { CLIError } from "@/util/error/error";
import { setupVaultSSO } from "@/util/sso/tasks/setupVaultSSO";
import { GLOBAL_REGION, MANAGEMENT_ENVIRONMENT, MODULES } from "@/util/terragrunt/constants";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import { setupAuthentik } from "./setupAuthentik";
import { setupFederatedAuth } from "./setupFederatedAuth";

/**
 * CLI command for installing Authentik SSO in a Panfactum cluster
 * 
 * @remarks
 * This command deploys and configures Authentik, an open-source identity
 * provider that serves as the central authentication system for Panfactum.
 * It provides:
 * 
 * - **Single Sign-On (SSO)**: One login for all Panfactum services
 * - **Identity Provider**: SAML and OIDC support for applications
 * - **User Management**: Centralized user and group administration
 * - **Multi-Factor Authentication**: Enhanced security options
 * - **Federation**: Integration with external identity providers
 * 
 * The installation process includes:
 * 1. **Authentik Core**: The main identity provider service
 * 2. **AWS Federation**: SSO access to AWS console and CLI
 * 3. **Vault Federation**: SSO for HashiCorp Vault access
 * 
 * Prerequisites:
 * - A deployed Kubernetes cluster in the target region
 * - Proper DNS configuration for the SSO domain
 * - Admin access to the environment
 * 
 * Post-installation:
 * - Access Authentik UI at https://authentik.{region}.{environment}
 * - Configure user accounts and groups
 * - Set up application integrations
 * - Enable MFA policies
 * 
 * @example
 * ```bash
 * # Install SSO interactively
 * pf sso add
 * 
 * # After installation, access Authentik:
 * # https://authentik.us-east-1.production.example.com
 * ```
 * 
 * @see {@link setupAuthentik} - Core Authentik deployment
 * @see {@link setupFederatedAuth} - AWS federation setup
 * @see {@link setupVaultSSO} - Vault federation setup
 */
export class SSOAddCommand extends PanfactumCommand {
    static override paths = [["sso", "add"]];

    static override usage = Command.Usage({
        description: "Install Authentik in a Panfactum cluster",
        category: 'SSO',
        details:
            "This command sets up a new Authentik instance.",
        examples: [["Start Authentik installation", "pf sso add"]],
    });

    /**
     * Executes the SSO installation process
     * 
     * @remarks
     * This method orchestrates the complete SSO deployment including:
     * - Environment and region selection
     * - Authentik core deployment
     * - AWS federated authentication setup
     * - Vault SSO integration
     * 
     * The process uses Listr for task management, providing visual
     * feedback during the multi-step installation. Tasks are skipped
     * if already completed, making the process idempotent.
     * 
     * @throws {@link CLIError}
     * Throws when no environments or regions are available
     * 
     * @throws {@link CLIError}
     * Throws when any installation task fails
     */
    async execute() {
        this.context.logger.info("Starting Authentik installation process")

        /*******************************************
         * Select Environment and Region
         *******************************************/
          // todo: just show a single list env/regions where clusters are deployed
        const environments = (await getEnvironments(this.context)).filter(env => env.name !== MANAGEMENT_ENVIRONMENT && env.deployed);

        if (environments.length === 0) {
            throw new CLIError([
                "No environments found. Please run `pf env add` to create an environment first.",
            ]);
        }

        const selectedEnvironment = await this.context.logger.select({
            message: "Select the environment for where SSO will be deployed:",
            choices: environments.map(env => ({
                value: env,
                name: `${env.name}`
            })),
        });

        const regions = (await getRegions(this.context, selectedEnvironment.path)).filter(region => region.name !== GLOBAL_REGION && region.clusterDeployed);

        if (regions.length === 0) {
            throw new CLIError([
                `No available regions with clusters installed found in environment ${selectedEnvironment.name}.`,
            ]);
        }

        const selectedRegion = await this.context.logger.select({
            message: "Select the region for the SSO deployment:",
            choices: regions.map(region => ({
                value: region,
                name: `${region.name}`
            })),
        });

        const tasks = new Listr([], { rendererOptions: { collapseErrors: false } });

        tasks.add({
            title: this.context.logger.applyColors("Setup Authentik"),
            skip: async () => {
                // todo: remove and utilize api to confirm user token setup completion
                const authentikCoreResourcesPfYAMLFileData = await readYAMLFile({
                    filePath: join(selectedRegion.path, MODULES.AUTHENTIK_CORE_RESOURCES, ".pf.yaml"),
                    context: this.context,
                    validationSchema: z
                        .object({
                            user_setup_complete: z.boolean().optional(),
                        })
                        .passthrough(),
                })
                return !!authentikCoreResourcesPfYAMLFileData?.user_setup_complete;
            },
            task: async (_, mainTask) => {
                return setupAuthentik({
                    context: this.context,
                    mainTask,
                    regionPath: selectedRegion.path
                });
            }
        });

        tasks.add({
            title: this.context.logger.applyColors("Setup AWS Federated SSO"),
            skip: async () => {
                const awsEKSPfYAMLFileData = await readYAMLFile({
                    filePath: join(selectedRegion.path, MODULES.AWS_EKS, ".pf.yaml"),
                    context: this.context,
                    validationSchema: z
                        .object({
                            federatedAuthEnabled: z.boolean().optional(),
                        })
                        .passthrough(),
                })
                return !!awsEKSPfYAMLFileData?.federatedAuthEnabled;
            },
            task: async (_, mainTask) => {
                return setupFederatedAuth({
                    context: this.context,
                    mainTask,
                    regionPath: selectedRegion.path
                });
            }
        });

        tasks.add({
            title: this.context.logger.applyColors("Setup Vault Federated SSO"),
            task: async (_, mainTask) => {
                return setupVaultSSO(this.context, mainTask, selectedRegion.path);
            }
        })

        await tasks.run().catch((e) => {
            throw new CLIError("Failed to Install Authentik", e);
        })
    }
}