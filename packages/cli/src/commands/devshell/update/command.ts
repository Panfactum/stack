import { Command } from "clipanion";
import { Listr } from "listr2";
import { PanfactumCommand } from "@/util/command/panfactumCommand";
import { buildSyncAWSIdentityCenterTask } from "@/util/devshell/tasks/syncAWSIdentityCenterTask";
import { buildSyncKubeClustersTask } from "@/util/devshell/tasks/syncKubeClustersTask";
import { buildSyncSSHTask } from "@/util/devshell/tasks/syncSSHTask";
import { CLIError } from "@/util/error/error";

export class DevShellUpdateCommand extends PanfactumCommand {
  static override paths = [["devshell", "update"]];

  static override usage = Command.Usage({
    description: "Updates the DevShell configuration",
    details:
      "Synchronizes the live infrastructure with configuration settings in your repository that control the DevShell's behavior.",
    examples: [["Update", "pf devshell update"]],
  });

  async execute() {
    const { context } = this;

    const tasks = new Listr([])

    tasks.add(
      await buildSyncKubeClustersTask({ context }),
    )

    tasks.add(
      await buildSyncSSHTask({ context })
    )

    tasks.add(
      await buildSyncAWSIdentityCenterTask({ context })
    )

    try {
      await tasks.run()
    } catch (e) {
      throw new CLIError("Fail to sync DevShell", e)
    }
  }
}