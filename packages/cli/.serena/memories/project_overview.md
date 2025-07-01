# Panfactum Project Overview

The **Panfactum Framework** is an integrated set of OpenTofu (Terraform) modules and local tooling for building, deploying, and managing software on AWS and Kubernetes.

## Key Components

1. **Panfactum CLI** (`packages/cli`) - Command-line interface for infrastructure setup and management
2. **Infrastructure Modules** (`packages/infrastructure`) - OpenTofu/Terraform modules for AWS and Kubernetes
3. **Documentation Website** (`packages/website`) - The panfactum.com documentation site
4. **Reference Architecture** (`packages/reference`) - Example infrastructure configurations
5. **Nix Development Environment** (`packages/nix`) - Local development shell and tooling
6. **Other packages**: Web scraper, installer, bastion host, vault

## Tech Stack (CLI)

- **Runtime**: Bun (JavaScript runtime)
- **Language**: TypeScript with strict type checking
- **Command Framework**: Clipanion
- **Key Libraries**: AWS SDK v3, Kubernetes client, Zod, listr2, Inquirer.js

## Repository Structure

- Monorepo managed with pnpm workspaces
- Each package has its own dependencies and build process
- CLI is the main focus for command-line infrastructure management