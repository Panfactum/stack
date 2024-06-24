#!/usr/bin/env bash

set -eo pipefail

SCRIPT=$(realpath "$0")
SCRIPTPATH=$(dirname "$SCRIPT")

# save incoming YAML to file
cat <&0 >"$SCRIPTPATH/all.yaml"

# Set the scheduler
export SCHEDULER="$1"
envsubst -i "$SCRIPTPATH/events_controller_template.yaml" >"$SCRIPTPATH/events_controller.yaml"
envsubst -i "$SCRIPTPATH/webhook_template.yaml" >"$SCRIPTPATH/webhook.yaml"

# run kustomize
kustomize build "$SCRIPTPATH"

# rm all.yaml to prevent future hashes from breaking
rm -f "$SCRIPTPATH/all.yaml"
rm -f "$SCRIPTPATH/events_controller.yaml"
