#!/usr/bin/env bash

set -eo pipefail

# Step 1: Checkout the code
cd /code || exit
pf-wf-git-checkout --repo "$GIT_REPO" --checkout "$GIT_REF"
cd repo || exit

# Step 2: Get the commit hash from the checked-out repo
GIT_COMMIT_HASH=$(git rev-parse HEAD)

# Step 3: Upload to S3
INSTALLER_PATH="packages/installer/install.sh"

# If git_ref is main, then overwrite the main installer
if [[ $GIT_REF == "main" ]]; then
  VERSION="main"
elif [[ $IS_TAG == "1" ]]; then
  VERSION=$GIT_REF
else
  VERSION=$GIT_COMMIT_HASH
fi
sed -i "s/VERSION=\"main\"/VERSION=\"$VERSION\"/" "$INSTALLER_PATH"
aws s3 cp "$INSTALLER_PATH" "s3://$BUCKET_NAME/$VERSION.sh" --acl bucket-owner-full-control
