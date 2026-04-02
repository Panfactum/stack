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
## Step 1: Scale up buildkit
###########################################################
/bin/pf buildkit scale up "$@"
