#!/usr/bin/env bash

set -eo pipefail

# Step 1: Get the GIT_COMMIT_HASH
GIT_COMMIT_HASH=$(pf-get-commit-hash --repo "https://$GIT_REPO" --ref "$GIT_REF" --no-verify)

# Step 2: Checkout the code
cd /code || exit
pf-wf-git-checkout --repo "$GIT_REPO" --checkout "$GIT_COMMIT_HASH"
cd repo || exit

# Step 2: Upload to S3
tar -cf - --directory=packages/infrastructure . |
  gzip -9 |
  aws s3 cp - "s3://$BUCKET_NAME/$GIT_COMMIT_HASH/modules.tar.gz" --acl bucket-owner-full-control
