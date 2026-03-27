#!/usr/bin/env bash

set -eo pipefail

###########################################################
## Step 1: Get the ECR credentials
###########################################################

ECR_PASSWORD=$(aws ecr get-login-password --region "$IMAGE_REGION")

###########################################################
## Step 2: Set the image tag as the commit sha
###########################################################
cd /code/stack
TAG=$(git rev-parse "$GIT_REF")

###########################################################
## Step 3: Push the merged manifest
###########################################################
manifest-tool \
  --username AWS \
  --password "$ECR_PASSWORD" \
  push from-args \
  --platforms linux/amd64,linux/arm64 \
  --template "${IMAGE_REGISTRY}/${IMAGE_REPO}:${TAG}-ARCH" \
  --target "${IMAGE_REGISTRY}/${IMAGE_REPO}:${TAG}"
