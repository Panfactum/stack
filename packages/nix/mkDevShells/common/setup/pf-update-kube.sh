#!/usr/bin/env bash

set -eo pipefail

# Purpose: Adds the standard .ssh configuration files

if [ -z "${PF_KUBE_DIR}" ]; then
  echo "Error: PF_KUBE_DIR is not set. Add it to your devenv.nix file." >&2
  exit 1
fi

destination=$(realpath "$DEVENV_ROOT/$PF_KUBE_DIR")
source=$(dirname "$(dirname "$(realpath "$0")")")/files/kube

mkdir -p "$destination"

rsync -rp --chmod=Du=rwx,Dg=rx,Do=rx,Fu=rw,Fg=r,Fo=r "$source"/ "$destination"/

echo "Kubernetes config files in $PF_KUBE_DIR were updated." 1>&2
