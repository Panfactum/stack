#!/usr/bin/env bash

set -eo pipefail

# Purpose: Utility to update the .gitignore file in the repository
# to ignore the Panfactum-created files

if [[ -z ${DEVENV_ROOT} ]]; then
  echo "Error: DEVENV_ROOT is not set. This should only be run inside of devenv." >&2
  exit 1
fi

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
  git check-ignore "$DEVENV_ROOT/$1" >/dev/null
}

# gitignores the file if it is not already ignored
function addIgnoreIfNeeded() {
  if ! isIgnored "$1"; then
    addLine "$1" "$DEVENV_ROOT/.gitignore"
  fi
}

addIgnoreIfNeeded .env
addIgnoreIfNeeded .terragrunt-cache
addIgnoreIfNeeded .terraform
addIgnoreIfNeeded .devenv
addIgnoreIfNeeded .direnv

echo ".gitignore updated" 1>&2

pf-check-repo-setup
