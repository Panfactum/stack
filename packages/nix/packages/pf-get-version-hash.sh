#!/usr/bin/env bash

set -eo pipefail

# This script is intended to support
# getting the git commit sha for a given version in our IaC paradigm.
# This is used to tag infrastructure and to reference build artifacts
# which are stored via commit shas

git_ref=$1
git_repo=${2:-origin}

# If the git ref is local, then this isn't pinned to a particular commit
# so just return "local"
if [[ $git_ref == "local" ]]; then
  echo "local"
  exit 0
fi

# If the ref is a commit hash already, we check to see if it is a valid hash
if [[ $git_ref =~ ^[0-9a-f]{40}$ ]]; then
  if [[ $git_repo == "origin" ]]; then
    if git fetch origin "$git_ref" 2>/dev/null; then
      echo "$git_ref"
      exit 0
    else
      echo "Error: commit $git_ref does not exist in the remote origin" >&2
      exit 1
    fi
  else
    temp_dir=$(mktemp -d)
    cd "$temp_dir"
    git init
    if git fetch "$git_repo" "$git_ref" 2>/dev/null; then
      echo "$git_ref"
      rm -rf "$temp_dir"
      exit 0
    else
      echo "Error: commit $git_ref does not exist in $git_repo" >&2
      rm -rf "$temp_dir"
      exit 1
    fi
  fi
fi

# Otherwise, we can simply fetch the hash from the remote
git ls-remote --exit-code "$git_repo" "$git_ref" | awk '{print $1}'
