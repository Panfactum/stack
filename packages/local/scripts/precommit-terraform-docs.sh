#!/usr/bin/env bash

set -eo pipefail

DOCS_DIR="$REPO_ROOT/packages/website/src/app/docs/main/reference/infrastructure-modules"

# Generate the docs
generate-tf-docs

# Lint them
(
  cd "$REPO_ROOT/packages/website"
  ./node_modules/.bin/remark "$DOCS_DIR" -e .mdx -e .md -o -S -r .remarkrc.mjs
)

git add "$DOCS_DIR"
