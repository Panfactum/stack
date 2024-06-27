#!/usr/bin/env bash

set -eo pipefail

###########################################################
## Step 1: CD to the codebase
###########################################################
cd /code/repo || exit

###########################################################
## Step 2: Set the image tag as the commit sha
###########################################################
TAG="$(git rev-parse "$GIT_REF")-$ARCH"

###########################################################
## Step 3: Get BuildKit address
###########################################################
BUILDKIT_HOST=$(pf-buildkit-get-address --arch="$ARCH")
export BUILDKIT_HOST

###########################################################
## Step 4: Get the ECR credentials
###########################################################

ECR_PASSWORD=$(aws ecr get-login-password --region "$IMAGE_REGION")
AUTH_TOKEN=$(echo "AWS:$ECR_PASSWORD" | base64 --wrap=0)
cat >"/.docker/config.json" <<EOF
{
    "auths": {
        "$IMAGE_REGISTRY": {
            "auth": "$AUTH_TOKEN"
        }
    }
}
EOF

###########################################################
## Step 5: Record the build
###########################################################
pf-buildkit-record-build --arch="$ARCH"

###########################################################
## Step 6: Build the image
###########################################################
buildctl \
  build \
  --frontend=dockerfile.v0 \
  --output "type=image,name=$IMAGE_REGISTRY/$IMAGE_REPO:$TAG,push=$PUSH_IMAGE" \
  --local context=. \
  --local dockerfile=. \
  --opt filename=./Dockerfile \
  --export-cache "type=s3,region=$BUILDKIT_BUCKET_REGION,bucket=$BUILDKIT_BUCKET_NAME,name=$IMAGE_REGISTRY/$IMAGE_REPO" \
  --import-cache "type=s3,region=$BUILDKIT_BUCKET_REGION,bucket=$BUILDKIT_BUCKET_NAME,name=$IMAGE_REGISTRY/$IMAGE_REPO"
