# Panfactum CLI

A command-line interface for Panfactum that helps with infrastructure setup and management for the Panfactum framework.

## Development Commands

All commands are run from the root of the project (`packages/cli`), from a terminal:

| Command          | Action                                      |
| :--------------- | :------------------------------------------ |
| `bun run build:binary`  | Builds the binary to `packages/cli/bin/pf`  |
| `bun run check` | Runs the typechecker    |
| `bun run lint` | Checks for linting errors (read-only) |
| `bun run lint:fix` | Auto-fix lint errors (some errors won't be autofixable)    |
| `bun test` | Runs the unit tests    |

## General Architecture

This is an CLI built on [Clipanion](https://github.com/arcanis/clipanion). This CLI expects to be run in the Panfactum devShell and is built with [Bun](https://bun.sh/).

All code is written in Typescript and uses `bun` as the package manager. We aim to enable the strictest possible type-checking and linting whenever possible.

### Key Dependencies

Besides Clipanion and Bun, take note of the following key dependencies:

- [listr2](https://listr2.kilic.dev/) - For running multi-step tasks with a pleasing UX
- [Inquirer.js](https://github.com/SBoudrias/Inquirer.js) - For getting user input in various formats through the terminal
- [picocolors](https://github.com/alexeyraspopov/picocolors) - For terminal output formatting
- [open](https://github.com/sindresorhus/open) - For opening browser windows
- [AWS SDK v3](https://github.com/aws/aws-sdk-js-v3) - For interacting with the AWS API
- [Kubernetes SDK](https://github.com/kubernetes-client/javascript) - For interacting with the Kubernetes API
- [Zod v3](https://v3.zod.dev/) - For input validation
- [yaml](https://github.com/eemeli/yaml) - For parsing and outputting YAML-formatted strings
- [ini](https://www.npmjs.com/package/ini) - For parsing and outputting INI-formatted strings


### Project Structure

See [TOC.md](TOC.md) for a description of this package's contents and [src/TOC.md](src/TOC.md) for the source code layout.

The command directory structure follows the CLI command structure. For example, the code for `pf cluster add` can be found
at `src/commands/cluster/add`. The main entrypoint for every command is the `command.ts` file; all other files in the
command directory are command-specific helpers.

If we re-use logic across multiple commands, we group those utilities in `src/util`.

# Contributing

Be sure to review and follow the guidelines documented in our [STYLEGUIDE](./STYLEGUIDE.md) when
making contributions.