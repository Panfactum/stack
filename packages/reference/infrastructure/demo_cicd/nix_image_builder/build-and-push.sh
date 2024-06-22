#!/usr/bin/env bash

set -eo pipefail

###########################################################
## Step 1: Check out the codebase
###########################################################
cd /code || exit
git clone https://github.com/Panfactum/stack.git --depth=1
cd stack || exit
export COMMIT_HASH=main
git checkout "$GIT_REF"

###########################################################
## Step 2: Install skopeo
###########################################################

nix-env -iA nixpkgs.skopeo

###########################################################
## Step 3: Login to GHCR
###########################################################
echo "$GITHUB_TOKEN" | skopeo login ghcr.io -u fullkykubed --password-stdin

###########################################################
## Step 4: Build the image derivations
###########################################################
nix --extra-experimental-features nix-command --extra-experimental-features flakes build '.#image'

###########################################################
## Step 5: Combine the image layers, gzip, and stream to the registry
###########################################################
./result | gzip --fast | skopeo copy docker-archive:/dev/stdin docker://ghcr.io/panfactum/panfactum:"$GIT_REF"-"$ARCH"
