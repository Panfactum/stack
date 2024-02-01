#!/usr/bin/env bash

set -eo pipefail

# This script is intended to support
# getting the git commit sha for a given version in our IaC paradigm.
# This is used to tag infrastructure and to reference build artifacts
# which are stored via commit shas

git_ref=$1

# We first attempt to fetch it from the remote
# in case we are working with a shallow repo clone
commit_hash=$(git ls-remote origin "$git_ref" | awk '{print $1}')

# shellcheck disable=SC2181
if [ "$?" -eq 0 ]; then
  echo "$commit_hash"
else
  # Otherwise, we fallback to attempting to fetch it from our local system
  git rev-parse
fi
