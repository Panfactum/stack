#!/usr/bin/env bash

set -eo pipefail

###########################################################
## Step 1: Install manifest-tool
###########################################################
nix-env -iA nixpkgs.manifest-tool nixpkgs.skopeo nixpkgs.awscli2
sleep 2

###########################################################
## Step 2: Login to ECR
###########################################################
ECR_PASSWORD=$(aws ecr get-login-password --region "$IMAGE_REGION")
PUBLIC_ECR_PASSWORD=$(aws ecr-public get-login-password --region us-east-1) # Public ECR is always in us-east-1

###########################################################
## Step 3: Push the merged manifest
###########################################################
manifest-tool \
  --username AWS \
  --password "$ECR_PASSWORD" \
  push from-args \
  --platforms linux/amd64,linux/arm64 \
  --template "$IMAGE_REGISTRY/$IMAGE_REPO:$COMMIT_SHA-ARCH" \
  --target "$IMAGE_REGISTRY/$IMAGE_REPO:$COMMIT_SHA"

###########################################################
## Step 4: Copy to public ECR
###########################################################
skopeo copy --all \
  --src-creds "AWS:$ECR_PASSWORD" \
  "docker://$IMAGE_REGISTRY/$IMAGE_REPO:$COMMIT_SHA" \
  --dest-creds "AWS:$PUBLIC_ECR_PASSWORD" \
  "docker://$PUBLIC_IMAGE_REGISTRY/$IMAGE_REPO:$COMMIT_SHA"
