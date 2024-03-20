#!/usr/bin/env bash

set -eo pipefail

DOCS_DIR="$DEVENV_ROOT/packages/website/src/app/(web)/docs/reference/terraform-modules"

# Generate the docs
generate-tf-docs

# Lint them
(
  cd "$DEVENV_ROOT/packages/website"
  ./node_modules/.bin/remark "$DOCS_DIR" -e .mdx -e .md -o -S -r .remarkrc.lint.mjs
)

git add "$DOCS_DIR"
