#!/usr/bin/env bash

set -eo pipefail

SCRIPT=$(realpath "$0")
SCRIPT_PATH=$(dirname "$SCRIPT")

# save incoming YAML to file
cat >"$SCRIPT_PATH/all.yaml"

# Set the scheduler
export SCHEDULER="$1"
envsubst -i "$SCRIPT_PATH/deployment_template.yaml" >"$SCRIPT_PATH/deployment.yaml"

# run kustomize
kustomize build "$SCRIPT_PATH"

rm -f "$SCRIPT_PATH/all.yaml"
rm -f "$SCRIPT_PATH/deployment.yaml"
