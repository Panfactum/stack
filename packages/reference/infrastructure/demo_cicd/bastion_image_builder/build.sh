#!/usr/bin/env bash

set -eo pipefail

###########################################################
## Step 1: Check out the codebase
###########################################################
cd /code || exit
git clone https://github.com/Panfactum/stack.git --depth=1
cd stack || exit
git checkout "$GIT_REF"

###########################################################
## Step 2: Get BuildKit address
###########################################################
export BUILDKIT_HOST=$(pf-buildkit-get-address --arch="$ARCH")

###########################################################
## Step 3: Build the image
###########################################################
buildctl \
  build \
  --frontend=dockerfile.v0 \
  --output "type=image,name=$IMAGE_REPO:$GIT_REF,push=$PUSH_IMAGE" \
  --local context=. \
  --local dockerfile=./packages/bastion \
  --opt filename=./packages/bastion/Containerfile
#  --export-cache "type=s3,region=$BUILDKIT_BUCKET_REGION,bucket=$BUILDKIT_BUCKET_NAME,name=$IMAGE_REPO"
#  --import-cache "type=s3,region=$BUILDKIT_BUCKET_REGION,bucket=$BUILDKIT_BUCKET_NAME,name=$IMAGE_REPO"
