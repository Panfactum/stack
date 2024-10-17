#!/usr/bin/env bash

set -eo pipefail

# Purpose: Utility to update the .gitignore file in the repository
# to ignore the Panfactum-created files

REPO_VARIABLES=$(pf-get-repo-variables)
REPO_ROOT=$(echo "$REPO_VARIABLES" | jq -r '.repo_root')

# Adds a line to a file ensuring its on its own line and not appended to an existing line
function addLine() {
  if [ -s "$2" ]; then
    if [ "$(tail -c 1 "$2")" != "" ]; then
      echo >>"$2"
    fi
  fi
  echo "$1" >>"$2"
}

# Returns 0 iff the file/dir is gitignored
function isIgnored() {
  git check-ignore "$REPO_ROOT/$1" >/dev/null
}

# gitignores the file if it is not already ignored
function addIgnoreIfNeeded() {
  if ! isIgnored "$1"; then
    addLine "$1" "$REPO_ROOT/.gitignore"
  fi
}

addIgnoreIfNeeded .env
addIgnoreIfNeeded .terragrunt-cache
addIgnoreIfNeeded .terraform
addIgnoreIfNeeded .devenv
addIgnoreIfNeeded .direnv

echo -e ".gitignore updated\n" 1>&2

if [[ $PF_SKIP_CHECK_REPO_SETUP != 1 ]]; then
  pf-check-repo-setup
fi
