#!/usr/bin/env bash

set -eo pipefail

SCRIPT=$(realpath "$0")
SCRIPTPATH=$(dirname "$SCRIPT")

# save incoming YAML to file
cat <&0 >"$SCRIPTPATH/all.yaml"

# Set the scheduler
export SCHEDULER="$1"
envsubst -i "$SCRIPTPATH/deployment-controller-template.yaml" >"$SCRIPTPATH/deployment-controller.yaml"
envsubst -i "$SCRIPTPATH/deployment-webhook-template.yaml" >"$SCRIPTPATH/deployment-webhook.yaml"

# Add labels
# shellcheck disable=SC2016
yq -iY --argjson labels "$2" '.metadata.labels += $labels | .spec.template.metadata.labels += $labels' "$SCRIPTPATH/deployment-controller.yaml"
# shellcheck disable=SC2016
yq -iY --argjson labels "$3" '.metadata.labels += $labels | .spec.template.metadata.labels += $labels' "$SCRIPTPATH/deployment-webhook.yaml"

# run kustomize
kustomize build "$SCRIPTPATH"

# rm all.yaml to prevent future hashes from breaking
rm -f "$SCRIPTPATH/all.yaml"
rm -f "$SCRIPTPATH/deployment-webhook.yaml"
rm -f "$SCRIPTPATH/deployment-controller.yaml"
