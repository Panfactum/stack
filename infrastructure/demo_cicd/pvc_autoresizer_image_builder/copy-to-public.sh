#!/usr/bin/env bash

set -eo pipefail

###########################################################
## Step 1: Get the ECR credentials
###########################################################

ECR_PASSWORD=$(aws ecr get-login-password --region "$IMAGE_REGION")
PUBLIC_ECR_PASSWORD=$(aws ecr-public get-login-password --region us-east-1) # Public ECR is always in us-east-1

###########################################################
## Step 2: Set the image tag as the commit sha
###########################################################
cd /code/repo
TAG=$(git rev-parse "$GIT_REF")

###########################################################
## Step 3: Copy the image to public ECR
###########################################################
skopeo copy --all \
  --src-creds "AWS:$ECR_PASSWORD" \
  "docker://$IMAGE_REGISTRY/$IMAGE_REPO:$TAG" \
  --dest-creds "AWS:$PUBLIC_ECR_PASSWORD" \
  "docker://$PUBLIC_IMAGE_REGISTRY/$IMAGE_REPO:$TAG"
