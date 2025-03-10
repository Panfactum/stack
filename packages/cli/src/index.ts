#!/usr/bin/env bun
import { Builtins, Cli } from "clipanion";

import { TerraformInitCommand } from "./commands/terraform/tf-init-command";

// @ts-ignore Bun needs the explicit non-index syntax to overwrite this at build time with the --define flag
const VERSION = process.env.VERSION ?? "unknown";

// Create a CLI instance
const cli = new Cli({
  binaryName: "pf",
  binaryLabel: "Panfactum CLI",
  binaryVersion: VERSION,
});

// Register commands
cli.register(Builtins.HelpCommand);
cli.register(Builtins.VersionCommand);
cli.register(TerraformInitCommand);

// Parse and run
cli.runExit(process.argv.slice(2), {
  ...Cli.defaultContext,
});
