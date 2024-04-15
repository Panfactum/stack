#!/usr/bin/env bash

# This script is used to update the website with the local code
# This is temporary and used in place of a CI pipeline for now

set -eo pipefail

# Extract the current version
MODULE_DIR="$PF_ENVIRONMENTS_DIR/production/us-east-2/pf_website"
VERSION_FILE="$MODULE_DIR/version.yaml"
CURRENT_VERSION=$(yq -r -e '.version' "$VERSION_FILE")

# Increment the version number
BASE_VERSION="${CURRENT_VERSION%.*}"    # Extracts "alpha"
VERSION_NUMBER="${CURRENT_VERSION##*.}" # Extracts the integer part
NEXT_VERSION_NUMBER=$((VERSION_NUMBER + 1))
NEXT_VERSION="$BASE_VERSION.$NEXT_VERSION_NUMBER"

# Login to ECR
aws --profile production-superuser ecr get-login-password --region us-east-2 | podman login --username AWS --password-stdin 891377197483.dkr.ecr.us-east-2.amazonaws.com

# Build the image
"$DEVENV_ROOT/../website/scripts/build-and-push-image.sh" "$NEXT_VERSION"

# Update the yaml file with the new version
yq -yi ".version = \"$NEXT_VERSION\"" "$VERSION_FILE"

# Apply terragrunt
(
  cd "$MODULE_DIR"
  terragrunt apply -auto-approve --terragrunt-non-interactive
)
