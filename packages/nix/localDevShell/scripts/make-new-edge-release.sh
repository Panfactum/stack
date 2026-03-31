#!/usr/bin/env bash

# Script is used to cut a new edge release of the docs and changelog.
WEBSITE_DIR="$REPO_ROOT/packages/website"
DOCS_DIR="$WEBSITE_DIR/src/content/docs"
CHANGELOG_DIR="$WEBSITE_DIR/src/content/changelog"
CONSTANTS_FILE="$WEBSITE_DIR/src/lib/constants.json"

# Get the current branch name
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Do some validation to ensure we don't create the wrong commit
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "You are not on the main branch. Cannot create edge release. Current branch: $CURRENT_BRANCH"
  exit 1
fi
if [[ -n $(git status --porcelain) ]]; then
  echo "There are unstaged or staged changes. Cannot create an edge release while the working directory is dirty. Please commit or stash them."
  exit 1
fi

# Remove existing edge release
rm -rf "$DOCS_DIR/edge"

# Copy the directory
cp -r "$DOCS_DIR/main" "$DOCS_DIR/edge"

# Search and replace /docs/main with /docs/edge in all files
find "$DOCS_DIR/edge" -type f -exec sed -i -E "s|([\"'(])/docs/main|\1/docs/edge|g" {} \;

# Search and replace __PANFACTUM_VERSION_MAIN__ with __PANFACTUM_VERSION_EDGE__ in all files
find "$DOCS_DIR/edge" -type f -exec sed -i -E "s|__PANFACTUM_VERSION_MAIN__|__PANFACTUM_VERSION_EDGE__|g" {} \;

# Get the new version tag and derive the edge directory name (strip "edge." prefix)
VERSION_TAG="edge.$(date +'%y-%m-%d')"
EDGE_DATE="${VERSION_TAG#edge.}"
EDGE_ENTRY_DIR="$CHANGELOG_DIR/edge/$EDGE_DATE"

# Update the version tag in constants
jq --arg tag "$VERSION_TAG" '.versions.edge.ref = "\($tag)"' "$CONSTANTS_FILE" >"$CONSTANTS_FILE.tmp" && mv "$CONSTANTS_FILE.tmp" "$CONSTANTS_FILE"

# Create the new edge entry directory and copy main/log.yaml into it
mkdir -p "$EDGE_ENTRY_DIR"
cp "$CHANGELOG_DIR/main/log.yaml" "$EDGE_ENTRY_DIR/log.yaml"

# If main/upgrade.mdx exists, move it to the new edge entry directory
if [ -f "$CHANGELOG_DIR/main/upgrade.mdx" ]; then
  mv "$CHANGELOG_DIR/main/upgrade.mdx" "$EDGE_ENTRY_DIR/upgrade.mdx"
fi

# Reset main/log.yaml to a clean template for the next release cycle
cat >"$CHANGELOG_DIR/main/log.yaml" <<'EOF'
summary: ""
changes: []
EOF

# Commit the changes and create the tag
git add "$REPO_ROOT"
git commit -m "release: $VERSION_TAG"
git tag --force "$VERSION_TAG"

# Push the changes
git push --atomic origin main "$VERSION_TAG"
