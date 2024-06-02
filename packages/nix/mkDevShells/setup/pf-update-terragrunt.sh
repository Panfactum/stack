#!/usr/bin/env bash

set -eo pipefail

# Purpose: Utility to update the terragrunt files in the repository
# to match the current version of the Panfactum stack

if [ -z "${PF_ENVIRONMENTS_DIR}" ]; then
  echo "Error: PF_ENVIRONMENTS_DIR is not set. Add it to your devenv.nix file." >&2
  exit 1
fi

environments_dir=$(realpath "$DEVENV_ROOT/$PF_ENVIRONMENTS_DIR")
source_dir=$(dirname "$(dirname "$(realpath "$0")")")/files/terragrunt

mkdir -p "$environments_dir"

rsync -rp --chmod=Du=rwx,Dg=rx,Do=rx,Fu=rw,Fg=r,Fo=r "$source_dir"/ "$environments_dir"/

echo -e "Terragrunt files in $PF_ENVIRONMENTS_DIR are updated.\n" 1>&2

if [[ $PF_SKIP_CHECK_REPO_SETUP != 1 ]]; then
  pf-check-repo-setup
fi
