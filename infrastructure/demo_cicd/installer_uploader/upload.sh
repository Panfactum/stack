#!/usr/bin/env bash

set -eo pipefail

# Step 1: Get the commit hash
GIT_COMMIT_HASH=$(pf-get-commit-hash --repo "https://$GIT_REPO" --ref "$GIT_REF" --no-verify)

# Step 2: Checkout the code
cd /code || exit
pf-wf-git-checkout --repo "$GIT_REPO" --checkout "$GIT_COMMIT_HASH"
cd repo || exit

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
