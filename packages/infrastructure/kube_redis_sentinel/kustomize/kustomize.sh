#!/usr/bin/env bash

set -eo pipefail

SCRIPT=$(realpath "$0")
SCRIPTPATH=$(dirname "$SCRIPT")

# save incoming YAML to file
cat <&0 >"$SCRIPTPATH/all.yaml"

export NAME="$1"
export PVC_GROUP="$2"
envsubst -i "$SCRIPTPATH/kustomization-template.yaml" >"$SCRIPTPATH/kustomization.yaml"

# run kustomize
kustomize build "$SCRIPTPATH"

# rm all.yaml to prevent future hashes from breaking
rm -f "$SCRIPTPATH/all.yaml"
rm -f "$SCRIPTPATH/kustomization.yaml"
