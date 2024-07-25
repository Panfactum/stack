#!/usr/bin/env bash

set -eo pipefail

# Purpose: Adds the .envrc to the root of the repository

REPO_VARIABLES=$(pf-get-repo-variables)
REPO_ROOT=$(echo "$REPO_VARIABLES" | jq -r '.repo_root')

destination_file="$REPO_ROOT/.envrc"
source_file=$(dirname "$(dirname "$(realpath "$0")")")/files/direnv/envrc

rsync -rp --chmod=Du=rwx,Dg=rx,Do=rx,Fu=rw,Fg=r,Fo=r "$source_file" "$destination_file"

echo -e ".envrc file in $REPO_ROOT is updated.\n" 1>&2

if [[ $PF_SKIP_CHECK_REPO_SETUP != 1 ]]; then
  pf-check-repo-setup
fi
