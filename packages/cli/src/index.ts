#!/usr/bin/env bun
import { Builtins, Cli } from "clipanion";
import { InstallClusterCommand } from "./commands/cluster/install/command.ts";
import { ConfigGetCommand } from "./commands/config/get/command.ts";
import { DevShellUpdateCommand } from "./commands/devshell/update/command.ts";
import { createPanfactumContext, type PanfactumContext } from "./context/context.ts";

// @ts-ignore Bun needs the explicit non-index syntax to overwrite this at build time with the --define flag
const VERSION = process.env.VERSION ?? "unknown";

// Create a CLI instance
const cli = new Cli<PanfactumContext>({
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

// Parse and run
cli.runExit(process.argv.slice(2), await createPanfactumContext(Cli.defaultContext));
