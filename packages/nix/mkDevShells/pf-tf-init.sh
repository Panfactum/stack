#!/usr/bin/env bash

# This script performs a few functions for all modules in the directory tree:
# 1. Runs `terraform init -upgrade` on every module (installs new submodules and updates the .terraform.lock.hcl provider versions)
# 2. Adds provider hashes to the .terraform.lock.hcl for every major platform

set -eo pipefail

# Define the function to display the usage
usage() {
  echo "Usage: pf-tf-init" >&2
  exit 1
}

####################################################################
# Step 1: Run init -upgrade on all modules to (a) update their submodules
# and (b) upgrade their provider versions
####################################################################

terragrunt run-all \
  init -upgrade

####################################################################
# Step 2: Update the platform locks to include all platforms
####################################################################

terragrunt run-all \
  providers lock \
  -platform=linux_amd64 \
  -platform=linux_arm64 \
  -platform=darwin_amd64 \
  -platform=darwin_arm64
