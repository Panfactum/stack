#!/usr/bin/env bash
set -eo pipefail

#####################################################
# Step 1: Clone source repo (monorepo)
#
# --sparse limits materialized files to $SOURCE_SUBPATH so
# blobs from the rest of the monorepo are never downloaded.
# --no-lfs is safe because packages/iac-provider has no
# LFS-tracked files (only images elsewhere in the repo are).
#####################################################
mkdir -p /code/source
cd /code/source
pf wf git-checkout \
  -r "$SOURCE_REPO" \
  -c "$GIT_REF" \
  -u "$GIT_USERNAME" \
  -p "$SOURCE_GIT_PASSWORD" \
  --sparse "$SOURCE_SUBPATH" \
  --no-lfs

#####################################################
# Step 2: Clone destination repo (provider repo)
#
# --no-lfs is safe because terraform-provider-pf is pure
# Go source with no LFS-tracked files.
#####################################################
mkdir -p /code/dest
cd /code/dest
pf wf git-checkout \
  -r "$DEST_REPO" \
  -c "main" \
  -u "$GIT_USERNAME" \
  -p "$DEST_GIT_PASSWORD" \
  --no-lfs

#####################################################
# Step 3: Sync files from packages/iac-provider
#         to the root of the provider repo
#####################################################
rsync -av --delete \
  --exclude='.git/' \
  --exclude='.envrc' \
  "/code/source/repo/${SOURCE_SUBPATH}/" \
  "/code/dest/repo/"

#####################################################
# Step 4: Check for changes and commit
#####################################################
cd /code/dest/repo

git config user.email "ci@panfactum.com"
git config user.name "Panfactum CI"
git add -A

# Use git status --porcelain for a reliable empty-tree check.
# git diff --cached alone can miss cases (e.g., new untracked files not yet
# reflected in the index diff against HEAD). After git add -A, porcelain output
# is empty IFF there is truly nothing staged.
if [ -z "$(git status --porcelain)" ]; then
  echo "No changes to sync. Provider repo is already up to date with ${GIT_REF}."
  exit 0
fi

git commit -m "sync: from panfactum/stack@${GIT_REF}"

#####################################################
# Step 5: Push to provider repo
#
# pf wf git-checkout checks out a specific commit SHA,
# leaving the repo in a detached HEAD state. We must
# push with HEAD:refs/heads/main to target the remote
# branch explicitly rather than relying on a local
# branch tracking ref.
#####################################################
git push --force-with-lease origin HEAD:refs/heads/main

echo "Successfully synced packages/iac-provider to terraform-provider-pf at ${GIT_REF}"