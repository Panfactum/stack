#!/usr/bin/env bash

set -eo pipefail

SCRIPT=$(realpath "$0")
SCRIPTPATH=$(dirname "$SCRIPT")
MODULEPATH=$(dirname "$SCRIPTPATH")
export DEPLOYMENT_NAME="$1"
RENDERPATH="$MODULEPATH/$DEPLOYMENT_NAME"

mkdir -p "$RENDERPATH"

# Set the deployment name
envsubst -i "$SCRIPTPATH/deployment_template.yaml" >"$RENDERPATH/deployment.yaml"
envsubst -i "$SCRIPTPATH/kustomization_template.yaml" >"$RENDERPATH/kustomization.yaml"

# save incoming YAML to file
cat <&0 >"$RENDERPATH/all.yaml"

# run kustomize
cd "$RENDERPATH"
kustomize build "$RENDERPATH"

# rm all.yaml to prevent future hashes from breaking
rm -rf "$RENDERPATH"
