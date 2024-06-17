#!/usr/bin/env bash

set -eo pipefail

# This script is intended to run as a pre-hook in terragrunt scripts
# to ensure that an image is available prior to applying changes.
# This is helpful in ensuring `terragrunt apply` does not execute
# prior to new images being built.

IMAGE_SPECIFIER=$1

# Extract account ID, region, repository name, and image tag
IFS=':' read -ra ADDR <<<"$IMAGE_SPECIFIER"
IMAGE_TAG="${ADDR[1]}"
IFS='/' read -ra ADDR <<<"${ADDR[0]}"
REPO_NAME="${ADDR[1]}"
IFS='.' read -ra ADDR <<<"${ADDR[0]}"
ACCOUNT_ID="${ADDR[0]}"
REPO_REGION="${ADDR[3]}"

# Timeout in seconds
TIMEOUT=${2:-300}

# Polling interval in seconds
INTERVAL=30

# Counter for elapsed time
ELAPSED=0

# Function to check if image with tag exists in the repository
image_exists() {
  aws ecr list-images \
    --registry-id "$ACCOUNT_ID" \
    --repository-name "$REPO_NAME" \
    --region "$REPO_REGION" \
    --query "imageIds[?imageTag=='$IMAGE_TAG']" \
    --output text
}

echo >&2 "Waiting up to $TIMEOUT seconds for image $IMAGE_SPECIFIER to be found."

# Loop to check for image presence within the timeout
while [[ $ELAPSED -lt $TIMEOUT ]]; do
  if [[ $(image_exists) ]]; then
    echo >&2 "Found $IMAGE_SPECIFIER."
    exit 0
  fi

  # Wait for the interval before checking again
  sleep $INTERVAL
  echo >&2 "Still waiting..."
  # Update elapsed time
  ELAPSED=$((ELAPSED + INTERVAL))
done

# If the script reached here, it means the image was not found within the timeout
echo >&2 "Could not find $IMAGE_SPECIFIER within $TIMEOUT seconds."
exit 1
