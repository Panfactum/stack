import { Command } from "clipanion";
import pc from "picocolors";
import { PanfactumCommand } from "@/util/command/panfactumCommand";
import { getRelativeFromRoot } from "@/util/fs/getRelativeFromRoot";

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

            ${pc.underline(pc.bold("Infrastructure-as-Code (IaC)"))}: All infrastructure
            is managed exclusively through OpenTofu (the OSS Terraform fork) and Terragrunt
            (a configuration manager and deployment tool for IaC). We primarily focus
            on enabling you to run workloads on supercharged Kubernetes clusters.

            The framework itself contains 100s of IaC modules. Some will be deployed directly
            (e.g., Kubernetes clusters) and others
            are submodules that can be used to build your own custom workloads.

            Every workload and configuration option that Panfactum uses is exposed directly
            to you -- no black-box abstractions. While Panfactum launches quickly with production-ready
            defaults, it is ultimately designed to be hackable so you can make the installation your own.

            ${pc.underline(pc.bold("Environments / Regions / Modules"))}: All IaC ${pc.italic("configuration")}
            (configuration-as-code) will be stored in the ${pc.bold(`./${getRelativeFromRoot(context, context.repoVariables.environments_dir)}`)}
            directory of this repository. That directory has three levels of nesting: 
            ${pc.blue("environment")}/${pc.yellow("region")}/${pc.green("module")} (e.g., production/us-east-2/aws_eks).

            An ${pc.blue("environment")} is an isolated deployment of an entire infrastructure system (clusters, workloads, etc).
            You will likely have several such as ${pc.italic("development")}, ${pc.italic("staging")}, and ${pc.italic("production")}
            that you use for different purposes such as testing and serving live traffic.

            A ${pc.yellow("region")} is analogous to a single geographic datacenter. Regions can have at most one Kubernetes
            cluster which is what runs all of the workloads deployed by the Panfactum framework.

            A ${pc.green("module")} is an atomic set of deployable infrastructure. Besides the DevShell, Panfactum
            provides many turn-key infrastructure modules to make getting started easy. You will likely also want to
            use our submodules to
            write your own first-party IaC modules in the ${pc.bold(`./${getRelativeFromRoot(context, context.repoVariables.iac_dir)}`)}
            directoy of this repository.




        `)

    }
}