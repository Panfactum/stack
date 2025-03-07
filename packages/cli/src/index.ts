#!/usr/bin/env bun
import { Cli, Command } from "clipanion";

// @ts-ignore Bun needs the explicit non-index syntax to overwrite this at build time with the --define flag
const VERSION = process.env.VERSION ?? "unknown";

class HelpCommand extends Command {
  static override paths = [["--help"], ["-h"]];

  async execute() {
    this.context.stdout.write("===================================\n");
    this.context.stdout.write("            PANFACTUM             \n");
    this.context.stdout.write("===================================\n");
    // this.context.stdout.write("Commands:\n\n");
    // this.context.stdout.write("Coming soon...\n\n");
    this.context.stdout.write("Options:\n");
    this.context.stdout.write("  -h, --help        Show this help message\n");
    this.context.stdout.write("  -v, --version     Show version number");
    return 0;
  }
}

class VersionCommand extends Command {
  static override paths = [["--version"], ["-v"]];

  async execute() {
    this.context.stdout.write(VERSION);
    return 0;
  }
}

// Create a CLI instance
const cli = new Cli({
  binaryName: "pf",
  binaryLabel: "Panfactum CLI",
  binaryVersion: VERSION,
});

// Register commands
cli.register(HelpCommand);
cli.register(VersionCommand);

// Parse and run
cli.runExit(process.argv.slice(2), {
  ...Cli.defaultContext,
});
