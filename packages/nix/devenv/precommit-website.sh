#!/usr/bin/env bash

set -eo pipefail

(
  cd "$DEVENV_ROOT/packages/website"
  export LINT=true
  npm i
  ./node_modules/.bin/next build
)
