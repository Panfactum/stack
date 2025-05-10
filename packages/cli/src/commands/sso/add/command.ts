import { join } from "node:path";
import { Command } from "clipanion";
import { Listr } from "listr2";
import { z } from "zod";
import { getPanfactumConfig } from "@/commands/config/get/getPanfactumConfig";
import { PanfactumCommand } from "@/util/command/panfactumCommand";
import { CLIError } from "@/util/error/error";
import { MODULES } from "@/util/terragrunt/constants";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import { setupAuthentik } from "./setupAuthentik";

export class SSOAddCommand extends PanfactumCommand {
    static override paths = [["sso", "add"]];

    static override usage = Command.Usage({
        description: "Install Authentik into a Panfactum cluster",
        details:
            "This command sets up a new Authentik instance.",
        examples: [["Start Authentik installation", "pf sso add"]],
    });

    async execute() {
        this.context.logger.info("Starting Authentik installation process")

        const tasks = new Listr([], { rendererOptions: { collapseErrors: false } });

        const config = await getPanfactumConfig({
            context: this.context,
            directory: process.cwd(),
        });

        const {
            environment,
            region,
        } = config;

        if (!environment || !region) {
            throw new CLIError([
                "Cluster installation must be run from within a valid region-specific directory.",
                "If you do not have this file structure please ensure you've completed the initial setup steps here:",
                "https://panfactum.com/docs/edge/guides/bootstrapping/configuring-infrastructure-as-code#setting-up-your-repo",
            ]);
        }

        const environmentPath = join(
            this.context.repoVariables.environments_dir,
            environment
        );
        const clusterPath = join(environmentPath, region);

        tasks.add({
            title: this.context.logger.applyColors("Setup Authentik"),
            skip: async () => {
                const authentikCoreResourcesConfig = await readYAMLFile({
                    filePath: join(clusterPath, MODULES.AUTHENTIK_CORE_RESOURCES, "module.yaml"),
                    context: this.context,
                    validationSchema: z
                        .object({
                            user_setup_complete: z.boolean().optional()
                        }).passthrough(),
                });
                return !!authentikCoreResourcesConfig?.user_setup_complete;
            },
            task: async (_, mainTask) => {
                return setupAuthentik(this.context, mainTask);
            }
        });

        try {
            await tasks.run();
        } catch (e) {
            throw new CLIError("Failed to Install Authentik", e);
        }
    }
}