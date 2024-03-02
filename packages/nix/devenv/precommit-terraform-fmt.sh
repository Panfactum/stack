#!/usr/bin/env bash

set -eo pipefail

# Store and return last failure from fmt so this can validate every directory passed before exiting
FMT_ERROR=0

for file in "$@"; do
  terraform fmt -diff -check "$file" || FMT_ERROR=$?
done

exit ${FMT_ERROR}
