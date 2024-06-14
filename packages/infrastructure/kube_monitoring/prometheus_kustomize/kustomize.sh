#!/usr/bin/env bash

set -eo pipefail

SCRIPT=$(realpath "$0")
SCRIPTPATH=$(dirname "$SCRIPT")

# save incoming YAML to file
cat <&0 >"$SCRIPTPATH/all.yaml"

# Set the scheduler
export SCHEDULER="$1"
envsubst -i "$SCRIPTPATH/grafana_template.yaml" >"$SCRIPTPATH/grafana.yaml"
envsubst -i "$SCRIPTPATH/ksm_template.yaml" >"$SCRIPTPATH/ksm.yaml"
envsubst -i "$SCRIPTPATH/operator_template.yaml" >"$SCRIPTPATH/operator.yaml"
envsubst -i "$SCRIPTPATH/operator_webhook_template.yaml" >"$SCRIPTPATH/operator_webhook.yaml"

# run kustomize
kustomize build "$SCRIPTPATH"

## rm to prevent hash conflicts
rm -r "$SCRIPTPATH/all.yaml"
rm -r "$SCRIPTPATH/grafana.yaml"
rm -r "$SCRIPTPATH/ksm.yaml"
rm -r "$SCRIPTPATH/operator.yaml"
rm -r "$SCRIPTPATH/operator_webhook.yaml"
