#!/usr/bin/env bash

set -eo pipefail

(
  cd "$REPO_ROOT"
  cspell lint --no-cache --no-progress --gitignore --exclude '**/website-2/**/*' '**/*.mdx' '**/*.md'
)
