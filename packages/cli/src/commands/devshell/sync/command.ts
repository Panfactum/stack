// This file defines the devshell sync command for updating local configuration
// It synchronizes the DevShell with live infrastructure state

import { Command } from "clipanion";
import { Listr } from "listr2";
import { PanfactumCommand } from "@/util/command/panfactumCommand";
import { buildSyncAWSIdentityCenterTask } from "@/util/devshell/tasks/syncAWSIdentityCenterTask";
import { syncDomainsTask } from "@/util/devshell/tasks/syncDomainsTask";
import { buildSyncKubeClustersTask } from "@/util/devshell/tasks/syncKubeClustersTask";
import { buildSyncSSHTask } from "@/util/devshell/tasks/syncSSHTask";
import { syncStandardFilesTask } from "@/util/devshell/tasks/syncStandardFiles";
import { runTasks } from "@/util/listr/runTasks";

/**
 * CLI command for synchronizing DevShell configuration with live infrastructure
 * 
 * @remarks
 * This command updates local DevShell configurations to match the current
 * state of deployed infrastructure. It ensures that local development
 * environments stay in sync with production and staging infrastructure.
 * 
 * The synchronization process includes:
 * 1. **Standard Files**: Updates critical configuration files
 * 2. **Domains**: Syncs DNS and domain configurations
 * 3. **Kubernetes Clusters**: Updates kubeconfig and cluster access
 * 4. **SSH Configuration**: Updates bastion and SSH access settings
 * 5. **AWS Identity Center**: Syncs SSO and identity configurations
 * 
 * Key benefits:
 * - Maintains consistency between local and remote environments
 * - Automatically discovers new infrastructure resources
 * - Updates credentials and access configurations
 * - Prevents configuration drift
 * - Enables quick onboarding for new team members
 * 
 * The command is idempotent and safe to run multiple times.
 * It only updates configurations that have changed.
 * 
 * Common use cases:
 * - After infrastructure deployments
 * - When joining a new project
 * - After credential rotations
 * - Troubleshooting access issues
 * 
 * @example
 * ```bash
 * # Sync all DevShell configurations
 * pf devshell sync
 * 
 * # Run after deploying new infrastructure
 * pf iac deploy && pf devshell sync
 * 
 * # Part of onboarding workflow
 * git clone repo && cd repo
 * direnv allow
 * pf devshell sync
 * ```
 * 
 * @see {@link syncStandardFilesTask} - Core file synchronization
 * @see {@link syncDomainsTask} - Domain configuration updates
 * @see {@link buildSyncKubeClustersTask} - Kubernetes cluster sync
 * @see {@link buildSyncSSHTask} - SSH configuration updates
 * @see {@link buildSyncAWSIdentityCenterTask} - AWS SSO sync
 */
export class DevShellUpdateCommand extends PanfactumCommand {
  static override paths = [["devshell", "sync"]];

  static override usage = Command.Usage({
    description: "Syncs the DevShell configuration with live infrastructure",
    category: 'Devshell',
    details:
      "Synchronizes the live infrastructure with configuration settings in your repository that control the DevShell's behavior.",
    examples: [["Update", "pf devshell update"]],
  });

  /**
   * Executes the DevShell synchronization process
   * 
   * @remarks
   * Runs multiple synchronization tasks in parallel where possible
   * to minimize execution time. Each task handles a specific aspect
   * of the DevShell configuration.
   * 
   * The tasks are:
   * - Standard files: Git hooks, configuration templates
   * - Domains: DNS records, certificate configurations
   * - Kubernetes: Cluster contexts, authentication tokens
   * - SSH: Known hosts, bastion configurations
   * - AWS: SSO profiles, temporary credentials
   * 
   * Progress is displayed using a visual task runner interface.
   * Errors in individual tasks are collected and reported together.
   * 
   * @throws {@link CLIError}
   * Throws when any synchronization task fails
   */
  async execute() {
    const { context } = this;

    const tasks = new Listr([], { rendererOptions: { collapseErrors: false } })

    tasks.add(
      await syncStandardFilesTask({ context })
    )

    tasks.add(
      await syncDomainsTask({ context })
    )

    tasks.add(
      await buildSyncKubeClustersTask({ context }),
    )

    tasks.add(
      await buildSyncSSHTask({ context })
    )

    tasks.add(
      await buildSyncAWSIdentityCenterTask({ context })
    )

    await runTasks({
      context,
      tasks,
      errorMessage: "Failed to sync DevSehll"
    })
  }
}