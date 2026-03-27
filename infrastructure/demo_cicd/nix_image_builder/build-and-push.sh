#!/usr/bin/env bash

set -eo pipefail

###########################################################
## Step 1: Check out the codebase
###########################################################
cd /code || exit
git clone https://github.com/Panfactum/stack.git --depth=1
cd stack || exit
git fetch origin "$GIT_REF"
git checkout "$GIT_REF"
COMMIT_SHA=$(git rev-parse "$GIT_REF")
TAG="$COMMIT_SHA-$ARCH"

###########################################################
## Step 2: Save the commit sha to reference later
###########################################################

echo "$COMMIT_SHA" >/tmp/commit-sha

###########################################################
## Step 3: Install tools
###########################################################
nix-env -iA nixpkgs.skopeo nixpkgs.awscli2
sleep 2 # fixes a race condition

###########################################################
## Step 4: Login to ECR
###########################################################
aws ecr get-login-password --region "$IMAGE_REGION" | skopeo login "$IMAGE_REGISTRY" -u AWS --password-stdin

###########################################################
## Step 5: Build the image derivations
###########################################################
nix --extra-experimental-features nix-command --extra-experimental-features flakes build '.#image'

###########################################################
## Step 6: Combine the image layers, gzip, and stream to the registry
###########################################################
./result | gzip --fast | skopeo copy docker-archive:/dev/stdin "docker://$IMAGE_REGISTRY/$IMAGE_REPO:$TAG"
