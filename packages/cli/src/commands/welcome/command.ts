import { Command } from "clipanion";
import pc from "picocolors";
import { PanfactumCommand } from "@/util/command/panfactumCommand";

export class WelcomeCommand extends PanfactumCommand {
    static override paths = [["welcome"]];

    static override usage = Command.Usage({
        description: "Displays the welcome screen for the DevShell"
    });

    async execute() {
        const { context } = this;

        context.logger.showLogo()

        context.logger.info(`
            Welcome to Panfactum! This is the ${pc.italic("DevShell")}, a local terminal
            environment that contains all of the utilities necessary to begin deploying
            and managing cloud infrastructure.

            It includes 100s of CLI utilities such as aws, tofu, terragrunt, kubectl, helm,
            and much more.

            Most importantly, it includes the Panfactum CLI (${pc.bold("pf")}) which will
            be used to automate your initial infrastructure setup.

            In the Panfactum framework, there are a few key tools
            and concepts to understand before you dive in:

            ${pc.underline(pc.bold("Infrastructure-as-Code"))}: All infrastructure
            is managed exclusively through OpenTofu (the OSS Terraform fork) and Terragrunt
            (a configuration manager and deployment tool for IaC).

            The Panfactum framework has 100s of IaC modules. Some will be deployed directly
            to create your foundational infrastructure (e.g., Kubernetes clusters) and others
            are submodules that can be used to build your own custom workloads.

            Every workload and configuration option that Panfactum uses is exposed directly
            to you -- no black-box abstractions. While Panfactum is launch quickly with production-ready
            defaults, it is ultimately designed to be hackable so you can make the installation your own.


            ${pc.underline(pc.bold("Environments / Regions"))}:
        `)

    }
}