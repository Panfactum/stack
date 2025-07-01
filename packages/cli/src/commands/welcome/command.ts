// This command displays the DevShell welcome screen for new users
// It's part of the deprecated welcome command group

import { randomUUID } from "crypto";
import { join } from "node:path";
import { Command } from "clipanion";
import pc from "picocolors";
import { PanfactumCommand } from "@/util/command/panfactumCommand";
import { upsertRepoVariables } from "@/util/context/upsertRepoVariables";
import { fileExists } from "@/util/fs/fileExists";
import { getRelativeFromRoot } from "@/util/fs/getRelativeFromRoot";

/**
 * Command for displaying the DevShell welcome screen
 * 
 * @deprecated This command is part of the deprecated 'welcome' command group.
 * The welcome functionality may be integrated elsewhere in the future.
 * 
 * @remarks
 * This command provides an onboarding experience for new Panfactum users.
 * It serves multiple purposes:
 * 
 * - First-time setup detection
 * - Welcome message with getting started guide
 * - Concept introduction for IaC and Panfactum
 * - Installation tracking for analytics
 * - User and installation ID generation
 * 
 * The command has three states:
 * 1. **Pre-installation**: Minimal message during setup
 * 2. **First run**: Full welcome screen with documentation
 * 3. **Subsequent runs**: No output (already welcomed)
 * 
 * Key features:
 * - Detects DevShell initialization state
 * - Displays comprehensive onboarding information
 * - Generates unique IDs for tracking
 * - Provides quick-start command examples
 * - Explains core Panfactum concepts
 * 
 * The welcome screen covers:
 * - DevShell capabilities
 * - Getting started steps
 * - Infrastructure-as-Code concepts
 * - Environment/Region/Module structure
 * - Kubernetes cluster features
 * - Help resources
 * 
 * @example
 * ```bash
 * # Display welcome screen (first time)
 * pf welcome
 * 
 * # No output on subsequent runs
 * pf welcome
 * ```
 * 
 * @see {@link upsertRepoVariables} - For storing installation IDs
 */
export class WelcomeCommand extends PanfactumCommand {
    static override paths = [["welcome"]];

    static override usage = Command.Usage({
        description: "Displays the welcome screen for the DevShell",
        category: 'Welcome',
        details: `
[DEPRECATED] This command is part of the deprecated 'welcome' command group.

Displays an onboarding welcome screen for new Panfactum users.
This command is typically run automatically when entering the DevShell
for the first time.

The welcome screen provides:
• Getting started instructions
• Core concept explanations  
• Quick-start command examples
• Help and support resources
        `,
        examples: [
            [
                'Display welcome screen',
                'pf welcome'
            ]
        ]
    });

    /**
     * Executes the welcome command
     * 
     * @remarks
     * This method determines the appropriate welcome behavior:
     * 
     * 1. **No .envrc**: DevShell is being set up (installer phase)
     * 2. **No installation_id**: First run after installation
     * 3. **Has installation_id**: Already welcomed (no action)
     * 
     * On first run, it:
     * - Shows the Panfactum logo
     * - Displays comprehensive welcome text
     * - Generates installation and user IDs
     * - Tracks the installation event
     * - Saves IDs for future detection
     * 
     * The welcome text includes:
     * - DevShell introduction
     * - Getting started commands
     * - Core concepts explanation
     * - Help resources
     * 
     * Analytics tracking helps understand:
     * - New installation rates
     * - Repository metadata
     * - User engagement
     */
    async execute() {
        const { context } = this;

        if (! await fileExists({ filePath: join(context.repoVariables.repo_root, ".envrc") })) {
            // This occurs in the installer script

            context.logger.info("DevShell setup for the first time.")

        } else if (!context.repoVariables.installation_id) {
            // This occurs immediately after the installer script

            context.logger.showLogo()

            context.logger.write(`
                Welcome to Panfactum! This is the ${pc.italic("DevShell")}, a local terminal
                environment containing all the utilities necessary to begin deploying
                and managing cloud infrastructure.
    
                The DevShell includes 100s of version-pinned CLI tools such as aws,
                tofu, terragrunt, kubectl, helm, and much more. These are installed in isolation from your
                main system and automatically load when you open this repository in your terminal.
    
                Most importantly, the DevShell includes the Panfactum CLI (${pc.bold(pc.whiteBright("pf"))}) which will
                be used to automate your initial infrastructure setup.
    
                ${pc.bold(pc.whiteBright("Getting Started ========================================================================================="))}
    
                The fastest way to get started:
    
                1. Create an environment: ${pc.bold(pc.whiteBright("pf env add"))}
    
                2. Add a domain: ${pc.bold(pc.whiteBright("pf domain add"))}
    
                3. Add a cluster: ${pc.bold(pc.whiteBright("pf cluster add"))}
    
                4. Deploy an IdP to enable SSO: ${pc.bold(pc.whiteBright("pf idp add"))} (Coming soon)
    
                5. (Optional) Deploy a demo workload: ${pc.bold(pc.whiteBright("pf demo deploy"))} (Coming soon)
    
                ${pc.bold(pc.whiteBright("Concepts ========================================================================================="))}
    
                ${pc.bold(pc.underline("Infrastructure-as-Code (IaC)"))}: All infrastructure
                is managed exclusively through OpenTofu (the OSS Terraform fork) and Terragrunt
                (a configuration manager and deployment tool for IaC). We enable
                you to run workloads on our supercharged Kubernetes clusters with out-of-the-box integrations
                to your infrastructure provider such as AWS.
    
                The framework itself contains 100s of IaC modules. Some will be deployed directly
                (e.g., Kubernetes clusters) and others
                are submodules that can be used to build your own custom workloads.
    
                Every workload and configuration option that Panfactum uses is exposed directly
                to you -- no black-box abstractions. While Panfactum helps you launch quickly with production-ready
                defaults, it is ultimately designed to be hackable so you can make the installation your own.
    
                ${pc.bold(pc.underline("Environments / Regions / Modules"))}: All IaC ${pc.italic("configuration")}
                (configuration-as-code) will be stored in the ${pc.bold(pc.whiteBright(`./${getRelativeFromRoot({ context, path: context.repoVariables.environments_dir })}`))}
                directory of this repository. That directory has three levels of nesting: 
                ${pc.blue("environment")}/${pc.yellow("region")}/${pc.green("module")} (e.g., production/us-east-2/aws_eks).
    
                An ${pc.blue("environment")} is an isolated deployment of an entire infrastructure system (clusters, workloads, etc).
                You will likely have several 
                that you use for different purposes such as testing and serving live traffic
                (e.g., ${pc.italic("development")}, ${pc.italic("staging")}, and ${pc.italic("production")}).
    
                A ${pc.yellow("region")} is analogous to a single geographic datacenter. Regions can have at most one Kubernetes
                cluster which is what runs all of the workloads deployed by the Panfactum framework.
    
                A ${pc.green("module")} is an atomic set of deployable infrastructure. Besides the DevShell, Panfactum
                provides many turn-key infrastructure modules to make getting started easy. You will likely also want to
                use our submodules to
                write your own first-party IaC modules in the ${pc.bold(pc.whiteBright(`./${getRelativeFromRoot({ context, path: context.repoVariables.iac_dir })}`))}
                directoy of this repository.
    
                The single source of truth for the configuration of all of your modules, regions, and environments lives
                on the ${pc.bold(pc.whiteBright(context.repoVariables.repo_primary_branch))} branch of this repository. The framework
                comes with standard CI/CD modules that enable you to keep that configuration synchronized with all of your
                live systems.
    
                ${pc.bold(pc.underline("Panfactum Kubernetes Clusters"))}: At the core of the Panfactum framework is the
                Panfactum Kubernetes cluster. All Panfactum workloads and modules are designed to run on these clusters
                which come preconfigured with all of the utilities every serious engineering organization wants:
                vertical/horizontal/node autoscaling, monitoring + alerting, an enterprise identity provider with out-of-the-box RBAC,
                zero-trust networking, a CI/CD system, a service-mesh, a policy engine, a workflow engine, and much, much more.
                
                Every tool Panfactum deploys is free, open-source, well-documented, and industry-standard (including Panfactum itself).
    
                Our aim is to ensure that running workloads on Panfactum clusters provides you 10x more functionality and flexibility
                at 10% of the complexity and cost of any other alternative. Learn more at https://panfactum.com.
    
                ${pc.bold(pc.whiteBright("Getting Help ========================================================================================="))}
    
                If you need assistance, connect with us on our discord server: https://discord.gg/MJQ3WHktAS
    
                If you think you've found a bug, please submit an issue: https://github.com/panfactum/stack/issues
    
                ${pc.dim("↓ Want to get rid of direnv clutter when loading the DevShell? https://direnv.net/man/direnv.toml.1.html#codehideenvdiffcode")}
            `, { removeIndent: true })

            const installationId = randomUUID()

            // todo: handle when userId is not set but installation Id exists
            const userId = randomUUID()

            await upsertRepoVariables({
                context,
                values: {
                    installation_id: installationId,
                }
            })

            await upsertRepoVariables({
                context,
                values: {
                    user_id: userId,
                },
                user: true
            })

            const groupProperties = {
                name: this.context.repoVariables.repo_name,
                repo_url: this.context.repoVariables.repo_url,
                date_installed: new Date().toISOString(),
            }

            // ensure group fires before the capture
            this.context.track.groupIdentify({
                distinctId: installationId,
                groupType: "repo",
                groupKey: installationId,
                properties: groupProperties,
            })

            this.context.track.capture({
                event: "cli-welcome",
                distinctId: userId,
                groups: {
                    repo: installationId,
                }
            })

            // delay and double flush required to ensure the group is created before the capture
            await this.context.track.flush()
            await Bun.sleep(1000);
            await this.context.track.flush()
        }
    } // todo: we want to capture when the devshell is initialized
}