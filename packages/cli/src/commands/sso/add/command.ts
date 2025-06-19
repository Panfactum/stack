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

export class SSOAddCommand extends PanfactumCommand {
    static override paths = [["sso", "add"]];

    static override usage = Command.Usage({
        description: "Install Authentik in a Panfactum cluster",
        category: 'SSO',
        details:
            "This command sets up a new Authentik instance.",
        examples: [["Start Authentik installation", "pf sso add"]],
    });

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
                return setupAuthentik(this.context, mainTask, selectedRegion.path);
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
                return setupFederatedAuth(this.context, mainTask, selectedRegion.path);
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