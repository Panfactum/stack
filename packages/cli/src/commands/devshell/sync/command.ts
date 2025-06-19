import { Command } from "clipanion";
import { Listr } from "listr2";
import { PanfactumCommand } from "@/util/command/panfactumCommand";
import { buildSyncAWSIdentityCenterTask } from "@/util/devshell/tasks/syncAWSIdentityCenterTask";
import { syncDomainsTask } from "@/util/devshell/tasks/syncDomainsTask";
import { buildSyncKubeClustersTask } from "@/util/devshell/tasks/syncKubeClustersTask";
import { buildSyncSSHTask } from "@/util/devshell/tasks/syncSSHTask";
import { syncStandardFilesTask } from "@/util/devshell/tasks/syncStandardFiles";
import { runTasks } from "@/util/listr/runTasks";

export class DevShellUpdateCommand extends PanfactumCommand {
  static override paths = [["devshell", "sync"]];

  static override usage = Command.Usage({
    description: "Syncs the DevShell configuration with live infrastructure",
    category: 'Devshell',
    details:
      "Synchronizes the live infrastructure with configuration settings in your repository that control the DevShell's behavior.",
    examples: [["Update", "pf devshell update"]],
  });

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