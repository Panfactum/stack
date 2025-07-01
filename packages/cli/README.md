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


### Project Structure (under `packages/cli`)

- `src/` - Contains the CLI source code
  - `files/` - Static files that are bundled directly with the CLI (the CLI is often used to generate files)
  - `templates/` - Files that are templated by the CLI during file creation
  - `commands/` - Contains the actual command definitions and command-specific helper utilities
  - `util/` - All utility code that is used throughout the CLI
  - `index.ts`- The main entrypoint that is run when the CLI is executed.

#### Commands

The command directory structure follows the CLI command structure. For example, the code for `pf cluster add` can be found
at `src/commands/cluster/add`. The main entrypoint for every command is the `command.ts` file; all other files in the
command directory are command-specific helpers.

We have the following top-level groups for commands:

- `aws` - Commands that perform operations against the AWS API
- `buildkit` - Commands that perform operations against the [Buildkit](https://github.com/moby/buildkit) resources (optionally deployed as a part of the Panfactum installation)
- `cluster` - Commands for installing and managing Kubernetes clusters
- `config` - Commands for managing and debugging the Panfactum installation's configuration
- `db` - Commands for interacting with databases in the Panfactum installation
- `devshell` - Commands for managing the local DevShell
- `docker` - Docker credential helpers
- `domain` - Commands for adding and managing DNS connected to the Panfactum installation
- `env` - Commands for installing and managing Panfactum environments
- `iac` - Commands for interacting with the IaC configuration
- `kube` - (Deprecated) Needs to be moved to `cluster`
- `sso` - Commands for interacting with the single sign-on configuration for the Panfactum installation
- `tunnel` - Commands for creating and managing network tunnels using the Panfactum SSH bastions
- `vault` - Commands for interacting with Hashicorp Vault installations
- `welcome` - (Deprecated) Needs to be moved to `devshell`
- `wf` - Commands used as a part of the Panfactum-provided CI/CD workflows

#### Utilities

If we re-use logic across multiple commands, we attempt to group those in `src/util`. We have the following groupings in that directory:

- `aws` - Interacting with AWS
- `browser` - Interacting with web browsers
- `buildkit` - Interacting with Moby Buildkit
- `command` - High-level command utilities
- `config` - Interacting with the Panfactum configuration
- `context` - (Deprecated) Move to `command`
- `db` - Interacting with databases installed by Panfactum
- `devshell` - Interacting with the local DevShell
- `docker` - (Deprecated) Move to `images`
- `domains` - Interacting with DNS
- `eks` - (Deprecated) Move to `aws`
- `error` - Utilities for creating and handling JS Errors
- `fs` - Interacting with the filesystem
- `git` - Interacting with `git`
- `json` - Handling JSON strings and files
- `kube` - Interacting with Kubernetes
- `listr` - Wrappers and utilities for interacting with the `listr2` task runner
- `network` - Network primitives
- `posthog` - Interacting with [Posthog](https://posthog.com/)
- `sops` - Interacting with [sops](https://github.com/getsops/sops) (encrypted files)
- `sso` - Interacting with the Panfactum SSO configuration
- `streams` - Managing Bun [streams](https://bun.sh/docs/api/streams)
- `subprocess` - Managing subprocesses created by CLI invocations
- `terragrunt` - Managing calls to [Terragrunt](https://terragrunt.gruntwork.io/docs/)
- `tunnel` - Managing network tunnels
- `vault` - Interacting with [Hashicorp Vault](https://developer.hashicorp.com/vault)
- `yaml` - Handling YAML strings and files
- `zod` - Zod utilities and validation wrappers

# Contributing

Be sure to review and follow the guidelines documented in our [STYLEGUIDE](./STYLEGUIDE.md) when
making contributions.