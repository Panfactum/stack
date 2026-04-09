#!/usr/bin/env bash

set -eo pipefail

(
  cd "$REPO_ROOT/packages/cli"
  export NODE_OPTIONS=--max-old-space-size=8192
  bun check
)
