#!/usr/bin/env bash

set -eo pipefail

# Step 1: Checkout the code
cd /code || exit
pf-wf-git-checkout --repo "$GIT_REPO" --checkout "$GIT_REF"
cd repo || exit

# Step 2: Get the commit hash from the checked-out repo
GIT_COMMIT_HASH=$(git rev-parse HEAD)

# Step 3: Upload to S3
tar -cf - --directory=packages/infrastructure . |
  gzip -9 |
  aws s3 cp - "s3://$BUCKET_NAME/$GIT_COMMIT_HASH/modules.tar.gz" --acl bucket-owner-full-control
