#!/usr/bin/env bash

set -eo pipefail

SCRIPT=$(realpath "$0")
SCRIPTPATH=$(dirname "$SCRIPT")

# save incoming YAML to file
cat <&0 >"$SCRIPTPATH/all.yaml"

# Set the scheduler
export SCHEDULER="$1"
envsubst -i "$SCRIPTPATH/deployment_template.yaml" >"$SCRIPTPATH/deployment.yaml"
envsubst -i "$SCRIPTPATH/webhook_deployment_template.yaml" >"$SCRIPTPATH/webhook_deployment.yaml"

# run kustomize
kustomize build "$SCRIPTPATH"

# rm all.yaml to prevent future hashes from breaking
rm -f "$SCRIPTPATH/all.yaml"
rm -f "$SCRIPTPATH/webhook_deployment.yaml"
rm -f "$SCRIPTPATH/deployment.yaml"
