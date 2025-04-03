#!/usr/bin/env bash

# Script is used to cut a new version of the docs

DOCS_DIR="$REPO_ROOT/packages/website/src/content/docs"
CONSTANTS_FILE="$REPO_ROOT/packages/website/src/lib/constants.json"

if [[ ! "$1" =~ ^[0-9]{2}-[0-9]{2}$ ]]; then
  echo "Error: The first argument must be in the format ##-## (e.g., 25-04)."
  exit 1
fi

RELEASE_SLUG="stable-$1"
RELEASE_PLACEHODLER="__PANFACTUM_VERSION_STABLE_${1//-/_}__"
CHANNEL_LABEL="Stable $1"
STABLE_BRANCH="stable.$1"
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
   "$CONSTANTS_FILE" > "$CONSTANTS_FILE.tmp" && mv "$CONSTANTS_FILE.tmp" "$CONSTANTS_FILE"

# # Commit the changes and create the tag
# git add "$REPO_ROOT"
# git commit -m "release: $VERSION_TAG"
# git tag --force "$VERSION_TAG"

# # Push the changes
# git push --atomic origin main "$VERSION_TAG"
