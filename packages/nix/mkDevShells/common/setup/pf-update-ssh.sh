#!/usr/bin/env bash

set -eo pipefail

# Purpose: Adds the standard .ssh configuration files

if [ -z "${PF_SSH_DIR}" ]; then
  echo "Error: PF_SSH_DIR is not set. Add it to your devenv.nix file." >&2
  exit 1
fi

destination=$(realpath "$DEVENV_ROOT/$PF_SSH_DIR")
source=$(dirname "$(dirname "$(realpath "$0")")")/files/ssh

mkdir -p "$destination"

rsync -rp --chmod=Du=rwx,Dg=rx,Do=rx,Fu=rw,Fg=r,Fo=r "$source"/ "$destination"/

echo "SSH config files in $PF_SSH_DIR were updated." 1>&2
