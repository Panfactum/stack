#!/usr/bin/env bash

# Checks which nix image tags already exist in ECR and outputs per-arch build flags.

set -eo pipefail

###########################################################
## Step 1: Resolve GIT_REF to a commit SHA
###########################################################
if [[ "$GIT_REF" =~ ^[0-9a-f]{40}$ ]]; then
  COMMIT_SHA="$GIT_REF"
else
  COMMIT_SHA=$(git ls-remote https://github.com/Panfactum/stack.git "$GIT_REF" | awk '{print $1}')
  if [[ -z "$COMMIT_SHA" ]]; then
    echo "WARNING: Could not resolve GIT_REF='$GIT_REF' to a commit SHA. Proceeding with full build."
    echo "$COMMIT_SHA" >/tmp/commit-sha
    echo "true" >/tmp/needs-build-amd64
    echo "true" >/tmp/needs-build-arm64
    echo "true" >/tmp/needs-merge
    exit 0
  fi
fi

echo "$COMMIT_SHA" >/tmp/commit-sha

###########################################################
## Step 2: Check each image tag independently
###########################################################

# Helper that returns 0 if the given tag exists in ECR
tag_exists() {
  aws ecr describe-images \
    --repository-name "$IMAGE_REPO" \
    --region "$IMAGE_REGION" \
    --image-ids imageTag="$1" >/dev/null 2>&1
}

# Per-arch images
for arch in amd64 arm64; do
  tag="${COMMIT_SHA}-${arch}"
  if tag_exists "$tag"; then
    echo "Image $IMAGE_REPO:$tag already exists. Skipping ${arch} build."
    echo "false" >"/tmp/needs-build-${arch}"
  else
    echo "Image $IMAGE_REPO:$tag not found. ${arch} build required."
    echo "true" >"/tmp/needs-build-${arch}"
  fi
done

# Multi-arch manifest
if tag_exists "$COMMIT_SHA"; then
  echo "Multi-arch manifest $IMAGE_REPO:$COMMIT_SHA already exists. Skipping merge."
  echo "false" >/tmp/needs-merge
else
  echo "Multi-arch manifest $IMAGE_REPO:$COMMIT_SHA not found. Merge required."
  echo "true" >/tmp/needs-merge
fi
