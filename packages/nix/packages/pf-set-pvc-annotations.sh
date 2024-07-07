#!/usr/bin/env bash

set -eo pipefail

####################################################################
# Step 1: Variable parsing
####################################################################
NAMESPACE=
CONFIG=

usage() {
  echo "Sets annotations on PVCs. Used to apply annotations on PVCs created by controllers like StatefulSets where" >&2
  echo "the PVC template is immutable." >&2
  echo "" >&2
  echo "Usage: pf-set-pvc-annotations -c <config> -n <namespace>" >&2
  echo "       pf-set-pvc-annotations --config <config> --namespace <namespace>" >&2
  echo "" >&2
  echo "<config>:       A JSON object mapping of PVC groups to annotations to apply to all PVCs in the pvc group" >&2
  echo "<namespace>:    The Kubernetes namespace containing the PVCs" >&2
  exit 1
}

# Parse command line arguments
TEMP=$(getopt -o c:n: --long namespace:,config:, -- "$@")

# shellcheck disable=SC2181
if [[ $? != 0 ]]; then
  echo "Failed parsing options." >&2
  exit 1
fi

# Note the quotes around `$TEMP`: they are essential!
eval set -- "$TEMP"

# Extract options and their arguments into variables
while true; do
  case "$1" in
  -n | --namespace)
    NAMESPACE="$2"
    shift 2
    ;;
  -c | --config)
    CONFIG="$2"
    shift 2
    ;;
  --)
    shift
    break
    ;;
  *)
    echo "Unknown argument provided: $1" >&2
    usage
    ;;
  esac
done

if [[ -z $CONFIG ]]; then
  echo "--config is a required argument." >&2
  exit 1
fi

if [[ -z $NAMESPACE ]]; then
  echo "--namespace is a required argument." >&2
  exit 1
fi

####################################################################
# Step 2: Apply the namespaces
####################################################################

# Process each top-level key (name) and its map of annotations
echo "$CONFIG" | jq -c 'to_entries[]' | while read -r ENTRY; do
  PVC_GROUP=$(echo "$ENTRY" | jq -r '.key')

  # Convert the annotation object into the form required by the kubectl CLI
  ANNOTATIONS=$(echo "$ENTRY" | jq -r '.value | to_entries | map(.key + "=" + .value) | join(",")')

  # Fetch the list of PVCs with the right 'pvc-group' label
  PVCS=$(kubectl get pvc -l pvc-group="$PVC_GROUP" -n "$NAMESPACE" -o name)

  # Add annotations to each PVC
  for PVC in $PVCS; do
    # Construct the kubectl annotate command
    kubectl annotate pvc "$PVC" -n "$NAMESPACE" "$ANNOTATIONS" --overwrite
  done
done
