#!/usr/bin/env bash
set -eo pipefail
(
  cd "$REPO_ROOT/packages/website"
  export NODE_OPTIONS=--max-old-space-size=8192
  export LINT=true
  files=()
  for file in "$@"; do
    files+=("${file#packages/website/}")
  done
  bunx eslint --fix --config eslint.config.js "${files[@]}"
)