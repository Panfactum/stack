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
## Step 1: Clone the codebase
###########################################################
cd /code
pf wf git-checkout \
  -r "$CODE_REPO" \
  -c "$GIT_REF" \
  -u "$GIT_USERNAME" \
  -p "$GIT_PASSWORD"
cd repo
