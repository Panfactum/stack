#!/usr/bin/env bash

set -eo pipefail

(
  cd "$DEVENV_ROOT"
  cspell lint --no-cache --no-progress '**/*.mdx' '**/*.md'
)
