#!/usr/bin/env bash
set -eo pipefail
(
  cd "$REPO_ROOT/packages/cli"
  export NODE_OPTIONS=--max-old-space-size=8192
  files=()
  for file in "$@"; do
    files+=("${file#packages/cli/}")
  done
  bunx eslint --fix --config eslint.config.js "${files[@]}"
)