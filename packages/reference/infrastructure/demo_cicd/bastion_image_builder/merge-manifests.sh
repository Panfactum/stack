#!/usr/bin/env bash

set -eo pipefail

###########################################################
## Step 1: Install manifest-tool
###########################################################
nix-env -iA nixpkgs.manifest-tool

###########################################################
## Step 2: Push the merged manifest
###########################################################
manifest-tool \
  --username fullykubed \
  --password "$GITHUB_TOKEN" \
  push from-args \
  --platforms linux/amd64,linux/arm64 \
  --template ghcr.io/panfactum/panfactum:"$GIT_REF"-ARCH \
  --target ghcr.io/panfactum/panfactum:"$GIT_REF"
