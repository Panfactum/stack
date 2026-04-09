#!/usr/bin/env bash

set -eo pipefail

(
  cd "$REPO_ROOT/packages/website"
  export NODE_OPTIONS=--max-old-space-size=8192
  pnpm check
)
