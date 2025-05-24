# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

The `packages/nix` directory contains Nix-based development environments and scripts for both Panfactum repository development and end-user development shells. It's divided into two main components:

1. **localDevShell**: Development environment for working on the Panfactum stack repository itself
2. **packages**: Packages and tools included in the standard Panfactum user development shell

## localDevShell

### Purpose
Provides the development environment specifically for contributors working on the Panfactum stack repository. This shell is activated via `nix develop` at the repository root.

### Key Scripts

#### Build and Deploy
- **build-panfactum-image.sh**: Builds and pushes Panfactum container images to GitHub Container Registry. Accepts optional tag parameter (defaults to 'latest'). Requires GITHUB_TOKEN environment variable for authentication.

#### Documentation Generation
- **generate-tf-docs.sh**: Generates Terraform module documentation for the website using terraform-docs. Processes all modules in infrastructure directory, adds provider links, creates MDX files, and outputs modules.json catalog.
- **generate-tf.sh**: Simple wrapper that calls generate-tf-docs.sh for Terraform module scaffolding.

#### Linting
- **lint.sh**: Comprehensive linting script that runs all linters: Terraform formatting, Terragrunt formatting, Nix formatting, shell formatting, spellcheck, website linting, and CLI type checking/linting. Sets NODE_OPTIONS for memory management.
- **lint-spellcheck.sh**: Runs cspell on all Markdown and MDX files in the repository using gitignore patterns.
- **lint-website.sh**: Runs type checking and linting for the website package with increased Node.js memory allocation.

#### Release Management
- **make-new-edge-release.sh**: Creates a new edge release from the main branch. Copies main docs to edge, updates version references, creates a version tag (edge.YY-MM-DD format), updates changelog, commits changes, and pushes to origin.
- **make-new-stable-release-channel.sh**: Creates a new stable release channel from the latest edge release. Creates a new branch (stable.YY-MM), copies edge docs, updates version placeholders, creates initial version tag, updates constants.json, and pushes changes.

#### Pre-commit Hooks
All pre-commit scripts follow the pattern `precommit-*.sh`:
- **precommit-lint-cli.sh**: Runs ESLint on CLI package files passed as arguments
- **precommit-lint-website.sh**: Runs ESLint on website package files passed as arguments
- **precommit-terraform-docs.sh**: Regenerates and lints Terraform documentation, then stages changes
- **precommit-terraform-fmt.sh**: Checks Terraform formatting without modifying files, exits with error if changes needed
- **precommit-terragrunt-fmt.sh**: Checks Terragrunt HCL formatting, exits with error if changes needed
- **precommit-typecheck-cli.sh**: Runs Bun type checking on CLI package
- **precommit-typecheck-website.sh**: Runs pnpm type checking on website package

### Environment Variables Set
- `REPO_ROOT`: Repository root directory
- `TERRAFORM_MODULES_DIR`: Location of infrastructure modules
- `PF_IAC_DIR`: Infrastructure as Code directory
- Various Go and tool-specific paths

## packages

### Purpose
Contains the standard Panfactum user development shell packages and utilities that end-users install for working with Panfactum-based infrastructure.

### Key Components

#### Custom Terragrunt Wrapper
- Includes Git LFS support for pulling large files
- Implements provider caching for faster operations
- Handles AWS authentication and profile switching

#### Included Tools
- **Kubernetes**: kubectl, helm, k9s, cilium-cli, linkerd, velero
- **AWS**: aws-cli, aws-ssm-plugin, aws-nuke
- **IaC**: OpenTofu, Terragrunt, terraform-ls, terraform-docs
- **Databases**: redis-cli, postgresql client, nats-cli
- **Containers**: buildkit, skopeo
- **Networking**: dig, mtr, ssh, curl, step-cli

### Key Scripts

#### Infrastructure Management
- **pf-tf-init.sh**: Initializes Terraform modules with provider locks. Runs `terragrunt run-all init -upgrade` to update submodules and provider versions, then locks providers for all major platforms (linux/darwin, amd64/arm64).
- **pf-tf-delete-locks.sh**: Releases Terraform state locks from DynamoDB. Accepts optional parameters for AWS profile, lock table, region, and lock owner. Defaults to terragrunt variables if not specified.
- **pf-get-repo-variables.sh**: Reads panfactum.yaml and returns repository configuration as JSON. Validates required fields, sets defaults, resolves directories to absolute paths, and adds computed variables like repo_root and iac_dir_from_git_root.

#### BuildKit Operations
- **pf-buildkit-build.sh**: Submits multi-platform container builds to BuildKit. Builds for both amd64 and arm64, uses S3 cache, pushes to ECR, creates multi-platform manifest. Manages SSH tunnels and handles cleanup.
- **pf-buildkit-clear-cache.sh**: Cleans up BuildKit cache by deleting unused PVCs and pruning cache in running pods. Accepts optional kubectl context parameter.
- **pf-buildkit-get-address.sh**: Returns the internal cluster address of the BuildKit instance with lowest CPU usage for the specified architecture (amd64/arm64).
- **pf-buildkit-record-build.sh**: Records build timestamp on BuildKit StatefulSet to defer auto-scaling down. Used to prevent scale-down during active builds.
- **pf-buildkit-scale-down.sh**: Scales BuildKit instances to 0 replicas. Supports timeout parameter to check last build time before scaling down.
- **pf-buildkit-scale-up.sh**: Scales BuildKit instances from 0 to 1 replica. Supports architecture filtering and waiting for pods to become ready.
- **pf-buildkit-tunnel.sh**: Sets up SSH tunnel to remote BuildKit instance. Handles scaling, address resolution, and tunnel establishment through bastion host.
- **pf-buildkit-validate.sh**: Shared validation script that provides common BuildKit variables and constants used by other BuildKit scripts.

#### Database/Service Access
- **pf-db-tunnel.sh**: Interactive database tunnel script. Lists available databases (PostgreSQL, Redis, NATS), retrieves credentials from Vault, establishes tunnel. Supports namespace filtering and automatic credential revocation on exit.
- **pf-tunnel.sh**: Generic SSH tunneling script for internal services. Uses Vault-signed SSH certificates, manages known hosts, uses autossh for reliability. Requires bastion configuration in ssh/config.yaml.

#### AWS/EKS Operations
- **pf-eks-resume.sh**: Resumes suspended EKS clusters. Scales up NAT gateways, restores node groups to original sizes, re-enables Karpenter, restores scheduler, clears pending pods.
- **pf-eks-suspend.sh**: Suspends EKS clusters to save costs. Scales down all nodes, terminates instances, optionally scales down NAT gateways, deletes load balancers, extends certificate expiration.
- **pf-get-aws-profile-for-kube-context.sh**: Returns the AWS profile configured for a given Kubernetes context. Reads from kube/config.user.yaml file.

#### Authentication/Secrets
- **pf-get-vault-token.sh**: Obtains Vault tokens for authentication. Supports OIDC login, token caching, automatic renewal when tokens near expiration. Includes silent mode for Terragrunt workflows.
- **pf-get-kube-token.sh**: Gets EKS authentication tokens with automatic SSO login handling. Manages concurrent SSO attempts with lock files, handles token expiration gracefully.
- **pf-get-db-creds.sh**: Retrieves database credentials from Vault for a specified role. Simple wrapper around vault read command with token authentication.
- **pf-sops-set-profile.sh**: Updates AWS profile in all SOPS-encrypted YAML files within a directory tree. Useful for CI/CD pipelines to standardize KMS access.
- **docker-credential-panfactum.sh**: Docker credential helper for ECR authentication. Implements get/erase commands, caches tokens, handles public and private ECR registries, integrates with AWS SSO.

#### Utilities
- **pf-get-commit-hash.sh**: Resolves git references to commit hashes. Supports remote repositories, validates commit existence, handles special 'local' ref for development.
- **pf-get-local-module-hash.sh**: Generates SHA1 hash of Terraform module contents for cache invalidation during local development.
- **pf-get-open-port.sh**: Finds an available local TCP port for tunneling. Searches randomly starting from port 1024-10024.
- **enter-shell-local.sh**: Initializes Panfactum development environment. Sets up Kubernetes/AWS paths, Terragrunt cache, BuildKit config, displays welcome message.
- **wait-on-image.sh**: Waits for container images to appear in ECR before proceeding. Used as Terragrunt pre-hook to ensure images exist before deployment. Configurable timeout.

#### Kubernetes Operations
- **pf-velero-snapshot-gc.sh**: Garbage collects orphaned Velero volume snapshots. Removes snapshots and contents when associated backup no longer exists.
- **pf-voluntary-disruptions-disable.sh**: Disables voluntary disruptions for PodDisruptionBudgets after time window expires. Sets maxUnavailable to 0.
- **pf-voluntary-disruptions-enable.sh**: Enables voluntary disruptions for PodDisruptionBudgets. Sets maxUnavailable based on annotations, records start time.
- **pf-vpc-network-test.sh**: Tests VPC network connectivity after deployment. Creates test instances in each subnet, verifies NAT traversal, confirms security.

#### Workflow
- **pf-wf-git-checkout.sh**: Efficiently checks out git repositories in CI/CD pipelines. Performs shallow clone, handles authentication, resolves refs to commits, initializes Git LFS.

## Architecture Notes

### Nix Flake Integration
Both components are integrated into the repository's Nix flake, providing:
- Reproducible development environments
- Pinned dependency versions
- Automatic shell hooks and environment setup

### Script Conventions
- Scripts use bash with strict error handling (`set -eo pipefail`)
- Environment variables are validated before use
- Color output for better user experience
- Consistent error messaging and exit codes

### Testing Scripts
When modifying scripts:
1. Test in the Nix development shell
2. Ensure compatibility with both macOS and Linux
3. Verify environment variable dependencies
4. Check for proper error handling

### Adding New Scripts
1. Create script in appropriate directory
2. Make executable: `chmod +x script.sh`
3. Add to `default.nix` in the scripts list
4. Follow existing naming conventions and patterns
5. Include proper shebang and error handling