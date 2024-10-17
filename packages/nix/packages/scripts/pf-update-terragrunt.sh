#!/usr/bin/env bash

set -eo pipefail

# Purpose: Utility to update the terragrunt files in the repository
# to match the current version of the Panfactum stack

REPO_VARIABLES=$(pf-get-repo-variables)
ENVIRONMENTS_DIR=$(echo "$REPO_VARIABLES" | jq -r '.environments_dir')

source_dir=$(dirname "$(dirname "$(realpath "$0")")")/files/terragrunt

mkdir -p "$ENVIRONMENTS_DIR"

rsync -rp --chmod=Du=rwx,Dg=rx,Do=rx,Fu=rw,Fg=r,Fo=r "$source_dir"/ "$ENVIRONMENTS_DIR"/

echo -e "Terragrunt files in $ENVIRONMENTS_DIR are updated.\n" 1>&2

if [[ $PF_SKIP_CHECK_REPO_SETUP != 1 ]]; then
  pf-check-repo-setup
fi
