#!/usr/bin/env bash

# Script is used to cut a new version of the docs

DOCS_DIR="$REPO_ROOT/packages/website/src/content/docs"
CHANGELOG_DIR="$REPO_ROOT/packages/website/src/content/changelog"
CONSTANTS_FILE="$REPO_ROOT/packages/website/src/lib/constants.json"

DATE=$(date +'%y-%m')
RELEASE_SLUG="stable-$DATE"
RELEASE_PLACEHODLER="__PANFACTUM_VERSION_STABLE_${DATE//-/_}__"
CHANNEL_LABEL="Stable.$DATE"
STABLE_BRANCH="stable.$DATE"
STABLE_VERSION_TAG="$STABLE_BRANCH.0"

# Get the current branch name
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Do some validation to ensure we don't create the wrong commit
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "Error: You are not on the main branch. Cannot create stable release channel. Current branch: $CURRENT_BRANCH"
  exit 1
elif git show-ref --verify --quiet "refs/heads/$STABLE_BRANCH" || git show-ref --verify --quiet "refs/remotes/origin/$STABLE_BRANCH"; then
  echo "Error: Branch '$STABLE_BRANCH' already exists. Cannot create a new stable release channel with the same name."
  exit 1
elif [[ -n $(git status --porcelain) ]]; then
  echo "Error: There are unstaged or staged changes. Cannot create an stable release channel while the working directory is dirty. Please commit or stash them."
  exit 1
fi

# Get the latest edge tag
LATEST_EDGE_TAG=$(git tag -l "edge.*" --sort=-v:refname | grep -e "^edge\.[0-9]{2}-[0-9]{2}-[0-9]{2}$" | head -n 1)

if [[ -z "$LATEST_EDGE_TAG" ]]; then
  echo "Error: No edge tags found. Cannot create a stable release channel without an edge release."
  exit 1
fi

# Check if the latest edge tag is on the current commit
CURRENT_COMMIT=$(git rev-parse HEAD)
EDGE_TAG_COMMIT=$(git rev-list -n 1 "$LATEST_EDGE_TAG")

if [[ "$CURRENT_COMMIT" != "$EDGE_TAG_COMMIT" ]]; then
  echo "Error: The latest edge tag ($LATEST_EDGE_TAG) is not on the current commit."
  echo "Current commit: $CURRENT_COMMIT"
  echo "Edge tag commit: $EDGE_TAG_COMMIT"
  echo "Please run make-new-edge-release before creating a stable release channel."
  exit 1
fi

# Remove existing release docs (if exists)
rm -rf "${DOCS_DIR:?}/$RELEASE_SLUG"

# Copy the edge docs
cp -r "$DOCS_DIR/edge" "$DOCS_DIR/$RELEASE_SLUG"

# Search and replace /docs/edge with /docs/$RELEASE_SLUG in all files
find "$DOCS_DIR/$RELEASE_SLUG" -type f -exec sed -i -E "s|([\"'(])/docs/edge|\1/docs/$RELEASE_SLUG|g" {} \;

# Search and replace __PANFACTUM_VERSION_EDGE__ with $RELEASE_PLACEHODLER in all files
find "$DOCS_DIR/$RELEASE_SLUG" -type f -exec sed -i -E "s|__PANFACTUM_VERSION_EDGE__|$RELEASE_PLACEHODLER|g" {} \;

# Update the constants.json file to include the new stable release channel
jq --arg slug "$RELEASE_SLUG" \
  --arg ref "$STABLE_VERSION_TAG" \
  --arg label "$CHANNEL_LABEL" \
  --arg placeholder "$RELEASE_PLACEHODLER" \
  '.versions[$slug] = {"ref": $ref, "placeholder": $placeholder, "label": $label, "slug": $slug}' \
  "$CONSTANTS_FILE" >"$CONSTANTS_FILE.tmp" && mv "$CONSTANTS_FILE.tmp" "$CONSTANTS_FILE"

# Create a new changelog file for the stable release channel
cat >"$CHANGELOG_DIR/$RELEASE_SLUG.mdx" <<EOF
---
summary: Initial release of the $CHANNEL_LABEL release channel.
---

import ChangelogEntry from "./ChangelogEntry.astro"
import MarkdownAlert from "@/components/markdown/MarkdownAlert.astro";

<ChangelogEntry>
  <Fragment slot="alerts">
    <MarkdownAlert severity="info">
      This release was forked from the $($LATEST_EDGE_TAG) edge release.
    </MarkdownAlert>
  </Fragment>
</ChangelogEntry>
EOF

# Commit the docs changes
git add "$REPO_ROOT"
git commit -m "release-channel: $STABLE_BRANCH"

# Commit the changes and create the tag
git checkout -b "$STABLE_BRANCH"
git tag --force "$STABLE_VERSION_TAG"

# Push the changes
git push --atomic origin main "$STABLE_BRANCH" "$STABLE_VERSION_TAG"

# Checkout main
git checkout main
