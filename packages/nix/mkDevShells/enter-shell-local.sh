#!/usr/bin/env bash

set -eo pipefail

# This script is meant to be sourced inside the enterShell
# parameter of our devenv.nix

#############################################
## Kubernetes
#############################################

# Use repo-local kubeconfig file
export KUBECONFIG="$DEVENV_ROOT/$PF_KUBE_DIR/config"
export KUBE_CONFIG_PATH="$DEVENV_ROOT/$PF_KUBE_DIR/config"

#############################################
## AWS
#############################################

# Use repo-local AWS settings
export AWS_SHARED_CREDENTIALS_FILE="$DEVENV_ROOT/$PF_AWS_DIR/credentials"
export AWS_CONFIG_FILE="$DEVENV_ROOT/$PF_AWS_DIR/config"

#############################################
## IaC
#############################################

# Use repo-local terragrunt downloads
export TERRAGRUNT_DOWNLOAD="$DEVENV_ROOT/.terragrunt-cache"

# This speeds up terragrunt commands that have dependencies significantly
# See https://terragrunt.gruntwork.io/docs/reference/cli-options/#terragrunt-fetch-dependency-output-from-state
export TERRAGRUNT_FETCH_DEPENDENCY_OUTPUT_FROM_STATE="true"

# Enables the local provider cache so that the provider binaries to significantly
# reduce the amount of times that we need to download provider binaries
export TF_PLUGIN_CACHE_DIR="$DEVENV_ROOT/.terraform"
mkdir -p "$TF_PLUGIN_CACHE_DIR"

#############################################
## Git LFS Fix
## This should be removed when updating to git 2.45
## as the new security features enables by this flag are
## currently broken for LFS. This doesn't disable
## any prior security features.
#############################################
export GIT_CLONE_PROTECTION_ACTIVE=false

#############################################
## Run checks
#############################################
pf-check-repo-setup
