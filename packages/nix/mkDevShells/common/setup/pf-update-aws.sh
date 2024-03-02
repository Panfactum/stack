#!/usr/bin/env bash

set -eo pipefail

# Purpose: Adds the standard .aws configuration files

if [ -z "${PF_AWS_DIR}" ]; then
  echo "Error: PF_AWS_DIR is not set. Add it to your devenv.nix file." >&2
  exit 1
fi

destination=$(realpath "$DEVENV_ROOT/$PF_AWS_DIR")
source=$(dirname "$(dirname "$(realpath "$0")")")/files/aws

mkdir -p "$destination"

cp -r --no-preserve=mode,ownership "$source"/. "$destination"/

echo "AWS config files in $PF_AWS_DIR were updated." 1>&2
