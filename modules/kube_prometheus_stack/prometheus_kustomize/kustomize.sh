#!/usr/bin/env bash

set -eo pipefail

SCRIPT=$(realpath "$0")
SCRIPTPATH=$(dirname "$SCRIPT")

# save incoming YAML to file
cat <&0 > "$SCRIPTPATH/all.yaml"

# run kustomize
kustomize build "$SCRIPTPATH"
