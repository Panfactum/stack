#!/usr/bin/env bun
import { Builtins, Cli, type BaseContext } from "clipanion";
import { AWSProfileListCommand } from "./commands/aws/profiles/list/command.ts";
import { InstallClusterCommand } from "./commands/cluster/install/command.ts";
import { ConfigGetCommand } from "./commands/config/get/command.ts";
import { DevShellUpdateCommand } from "./commands/devshell/update/command.ts";
import { DomainsAddCommand } from "./commands/domain/add/command.ts";
import { EnvironmentInstallCommand } from "./commands/env/install/command.ts";
import { createPanfactumContext, type PanfactumContext } from "./context/context.ts";
import type { PanfactumCommand } from "./util/command/panfactumCommand.ts";

// @ts-ignore Bun needs the explicit non-index syntax to overwrite this at build time with the --define flag
const VERSION = process.env.VERSION ?? "unknown";

// Create a CLI instance
const cli = new Cli<PanfactumContext | BaseContext>({
  binaryName: "pf",
  binaryLabel: "Panfactum CLI",
  binaryVersion: VERSION,
});

// Register commands
// Builtins
cli.register(Builtins.HelpCommand);
cli.register(Builtins.VersionCommand);

// Commands
cli.register(InstallClusterCommand);
cli.register(DevShellUpdateCommand)
cli.register(ConfigGetCommand)
cli.register(AWSProfileListCommand)
cli.register(EnvironmentInstallCommand)
cli.register(DomainsAddCommand)

const proc = cli.process({input: process.argv.slice(2)}) as PanfactumCommand

// Parse and run
cli.runExit(proc, await createPanfactumContext(
  Cli.defaultContext, 
  {
    logLevel: proc.logLevel
  }
));
