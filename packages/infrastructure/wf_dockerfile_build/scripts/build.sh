#!/usr/bin/env bash

set -eo pipefail

###########################################################
## Step 0: Check if the image already exists
###########################################################
if [[ -f "/tmp/exists" ]]; then
  echo "Skipping. Image already exists in the ECR repository."
  exit 0
fi

###########################################################
## Step 1: CD to the codebase
###########################################################
cd /code/repo || exit

###########################################################
## Step 2: Create the image tag (with arch suffix if needed)
###########################################################
TAG="$(cat /tmp/tag)$([ "$USE_ARCH_SUFFIX" = "1" ] && echo "-$ARCH" || echo "")"

###########################################################
## Step 3: Check if the image already exists
###########################################################
if aws ecr describe-images --repository-name "$IMAGE_REPO" --image-ids imageTag="$TAG" --region "$IMAGE_REGION" >/dev/null 2>&1; then
  echo "Skipping. Platform-specific image already exists in the ECR repository."
  exit 0
fi

###########################################################
## Step 4: Get BuildKit address
###########################################################
# todo: replace with pf buildkit get-address
BUILDKIT_HOST=$(pf-buildkit-get-address --arch="$ARCH")
export BUILDKIT_HOST

###########################################################
## Step 5: Get the ECR credentials
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
## Step 6: Record the build
###########################################################
# todo: replace with pf buildkit record-build
pf-buildkit-record-build --arch="$ARCH"

###########################################################
## Step 7: Build the image
###########################################################
# shellcheck disable=SC2086
buildctl \
  build \
  --frontend=dockerfile.v0 \
  --output "type=image,name=$IMAGE_REGISTRY/$IMAGE_REPO:$TAG,push=$PUSH_IMAGE" \
  --local context="$BUILD_CONTEXT" \
  --local dockerfile="$(dirname "$DOCKERFILE_PATH")" \
  --opt filename="./$(basename "$DOCKERFILE_PATH")" \
  $SECRET_ARGS \
  $BUILD_ARGS \
  --export-cache "type=s3,region=$BUILDKIT_BUCKET_REGION,bucket=$BUILDKIT_BUCKET_NAME,name=$IMAGE_REGISTRY/$IMAGE_REPO" \
  --import-cache "type=s3,region=$BUILDKIT_BUCKET_REGION,bucket=$BUILDKIT_BUCKET_NAME,name=$IMAGE_REGISTRY/$IMAGE_REPO"
