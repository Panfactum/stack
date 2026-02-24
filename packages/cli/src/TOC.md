# packages/cli/src/ Table of Contents

- `commands/` - CLI command implementations organized by domain: aws, buildkit, cluster, config, db, devshell, docker, domain, env, iac, kube, sso, tunnel, util, vault, welcome, and wf.
- `files/` - File generation logic for direnv, SSH, and Terragrunt configuration files that the CLI writes to disk.
- `index.ts` - CLI entry point that registers commands and bootstraps the application.
- `templates/` - HCL template files used to generate Terragrunt module configurations during infrastructure bootstrapping.
- `types/` - TypeScript type declarations for files and templates used throughout the CLI.
- `util/` - Shared utility modules organized by domain covering AWS, Kubernetes, networking, subprocess management, configuration, and more.
