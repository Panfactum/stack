#!/usr/bin/env bash

set -eo pipefail

####################################################################
# Step 1: Variable parsing
####################################################################
NAMESPACE=
CONFIG=

usage() {
  echo "Sets annotations and labels on PVCs in the same PVC group (defined by the panfactum.com/pvc-group label)." >&2
  echo "Used to update metadata on PVCs created by controllers like StatefulSets where"
  echo "the PVC template is immutable." >&2
  echo "" >&2
  echo "Usage: pf-set-pvc-metadata -c <config> -n <namespace>" >&2
  echo "       pf-set-pvc-metadata --config <config> --namespace <namespace>" >&2
  echo "" >&2
  echo "<config>:       A JSON object mapping of PVC groups to labels and annotations to apply to all PVCs in the pvc group" >&2
  echo '                Example: {"group1": {"labels": {"foo": "bar"}, "annotations": {"baz": "42"}}}' >&2
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
# Step 2: Apply the metadata
####################################################################

# Process each top-level key (name) and its map of annotations
echo "$CONFIG" | jq -c 'to_entries[]' | while read -r ENTRY; do
  PVC_GROUP=$(echo "$ENTRY" | jq -r '.key')

  # Convert the annotations and labels object into the form required by the kubectl CLI
  RAW_ANNOTATIONS=$(echo "$ENTRY" | jq -r '.value.annotations')
  if [[ $RAW_ANNOTATIONS != "null" ]]; then
    ANNOTATIONS=$(echo "$RAW_ANNOTATIONS" | jq -r 'to_entries | map(.key + "=" + .value) | join(" ")')
  fi
  RAW_LABELS=$(echo "$ENTRY" | jq -r '.value.labels')
  if [[ $RAW_LABELS != "null" ]]; then
    LABELS=$(echo "$RAW_LABELS" | jq -r 'to_entries | map(.key + "=" + .value) | join(" ")')
  fi

  if [[ $RAW_LABELS == "null" && $RAW_ANNOTATIONS == "null" ]]; then
    echo "Warning: No labels or annotations provided for pvc-group $PVC_GROUP" >&2
    continue
  fi

  # Fetch the list of PVCs with the right 'pvc-group' label
  PVCS=$(kubectl get pvc -l "panfactum.com/pvc-group=$PVC_GROUP" -n "$NAMESPACE" -o name)

  # Add metadata to each PVC
  for PVC in $PVCS; do
    if [[ $RAW_ANNOTATIONS != "null" ]]; then
      # shellcheck disable=SC2086
      kubectl annotate "$PVC" -n "$NAMESPACE" $ANNOTATIONS --overwrite
    fi
    if [[ $RAW_LABELS != "null" ]]; then
      # shellcheck disable=SC2086
      kubectl label "$PVC" -n "$NAMESPACE" $LABELS --overwrite
    fi
  done
done
