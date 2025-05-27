#!/usr/bin/env bun
import { Builtins, Cli, type BaseContext } from "clipanion";
import { AWSProfileListCommand } from "./commands/aws/profiles/list/command.ts";
import { ClusterAddCommand } from "./commands/cluster/add/command.ts";
import { ClusterEnableCommand } from "./commands/cluster/enable/command.ts";
import { ConfigGetCommand } from "./commands/config/get/command.ts";
import { DevShellUpdateCommand } from "./commands/devshell/sync/command.ts";
import { DomainAddCommand } from "./commands/domain/add/command.ts";
import { DomainRemoveCommand } from "./commands/domain/remove/command.ts";
import { EnvironmentInstallCommand } from "./commands/env/add/command.ts";
import { EnvironmentRemoveCommand } from "./commands/env/remove/command.ts";
import { UpdateModuleStatusCommand } from "./commands/iac/update-module-status/command.ts";
import { SSOAddCommand } from "./commands/sso/add/command.ts";
import { WelcomeCommand } from "./commands/welcome/command.ts";
import { createPanfactumContext, type PanfactumContext } from "./util/context/context.ts";
import { phClient } from "./util/posthog/tracking.ts";
import type { PanfactumCommand } from "./util/command/panfactumCommand.ts";

// Create a CLI instance
const cli = new Cli<PanfactumContext | BaseContext>({
  binaryName: "pf",
  binaryLabel: "Panfactum CLI"
});

// Register commands
// Builtins
cli.register(Builtins.HelpCommand);
cli.register(Builtins.VersionCommand);


// Commands
cli.register(ClusterAddCommand);
cli.register(ClusterEnableCommand);
cli.register(DevShellUpdateCommand)
cli.register(UpdateModuleStatusCommand)
cli.register(ConfigGetCommand)
cli.register(AWSProfileListCommand)
cli.register(EnvironmentInstallCommand)
cli.register(EnvironmentRemoveCommand)
cli.register(DomainAddCommand)
cli.register(DomainRemoveCommand)
cli.register(WelcomeCommand)
cli.register(SSOAddCommand)

try {
  const proc = cli.process({ input: process.argv.slice(2) }) as PanfactumCommand
  const panfactumContext = await createPanfactumContext(
    Cli.defaultContext,
    {
      debugEnabled: proc.debugEnabled ?? false,
      cwd: process.env["CWD"] || process.cwd()
    }
  )

  const { repoVariables } = panfactumContext
  if (repoVariables.user_id) {
    phClient.captureImmediate({
      event: 'cli-start',
      distinctId: repoVariables.user_id,
      // todo: pass in sub command level command arguments
      properties: {
        path: proc.path.join(" "),
        help: proc.help,
        debugEnabled: proc.debugEnabled,
        cwd: proc.cwd,
      }
    })
  }

  await cli.runExit(proc, panfactumContext);

  // todo: move to finally block
  await phClient.shutdown()
} catch(error: unknown) {
  await phClient.shutdown()
  if (error instanceof Error) {
    throw error.message;
  } else {
    throw error;
  }
}