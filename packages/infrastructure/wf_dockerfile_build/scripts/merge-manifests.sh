#!/usr/bin/env bash

set -eo pipefail

###########################################################
## Step 0: Check if the image already exists
###########################################################
if [[ -f "/tmp/exists" ]]; then
  echo "Skipping. Image already exists in the ECR repository."
  exit 0
fi
cd /code/repo

###########################################################
## Step 1: Get the ECR credentials
###########################################################

ECR_PASSWORD=$(aws ecr get-login-password --region "$IMAGE_REGION")

###########################################################
## Step 2: Get the image tag
###########################################################
TAG="$(cat /tmp/tag)"

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
