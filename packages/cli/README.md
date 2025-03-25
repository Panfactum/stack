# Panfactum CLI

A command-line interface for Panfactum that helps with infrastructure setup and management.

## Prerequisites

This CLI expects to be run in the Panfactum devShell and is built primarily with Bun.

## Theme

The CLI uses the [picocolors](https://github.com/picocolors/picocolors) library to colorize the output.

The general theme is as follows:

1. For general information and blocks of text use `pc.blue`.
2. For prompts use `pc.magenta`.
3. For errors use `pc.red`.
4. For directing the user to take and action use `pc.cyan`.
   4.a. For example, "To see your pods run `k9s` in a new terminal window."
5. For successes use `pc.green`.
