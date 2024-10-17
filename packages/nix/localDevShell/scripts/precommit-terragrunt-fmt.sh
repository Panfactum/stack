#!/usr/bin/env bash

set -eo pipefail

# Meant to be used as pre-commit hook
# Exits with 1 if hclfmt changes any files

for file in "$@"; do
  pushd "$(dirname "$file")" >/dev/null
  OUTPUT=$(terragrunt hclfmt --terragrunt-hclfmt-file "$(basename "$file")" 2>&1)
  if [[ $OUTPUT != "" ]]; then
    exit 1
  fi
  popd >/dev/null
done
