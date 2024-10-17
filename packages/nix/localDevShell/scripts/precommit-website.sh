#!/usr/bin/env bash

set -eo pipefail

(
  cd "$REPO_ROOT/packages/website"
  export LINT=true
  export NODE_OPTIONS=--max-old-space-size=8192
  npm i
  ./node_modules/.bin/next build
)
