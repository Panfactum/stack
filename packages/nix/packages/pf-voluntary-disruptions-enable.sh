#!/usr/bin/env bash

set -eo pipefail

####################################################################
# Step 1: Variable parsing
####################################################################

# Initialize our own variables:
NAMESPACE=
WINDOW_ID=

# Define the function to display the usage
usage() {
  echo "Enables disruptions for PDBs configured to allow time windows for disruptions."
  echo "Usage: pf-voluntary-disruptions-enable --namespace=<namespace> --window-id=<window-id>" >&2
  echo "       pf-voluntary-disruptions-enable -n=<namespace> -w=<window-id>" >&2
  echo "" >&2
  echo "<namespace>:        Namespace of the PDBs" >&2
  echo "<window-id>:        ID of the disruption window" >&2
  echo "" >&2
  exit 1
}

# Parse command line arguments
TEMP=$(getopt -o n:w: --long namespace:,window-id: -- "$@")

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
  -w | --window-id)
    WINDOW_ID="$2"
    shift 2
    ;;
  --)
    shift
    break
    ;;
  *)
    usage
    ;;
  esac
done

if [[ -z $NAMESPACE ]]; then
  echo "--namespace must be set" >&2
  exit 1
fi

if [[ -z $WINDOW_ID ]]; then
  echo "--window-id must be set" >&2
  exit 1
fi

####################################################################
# Step 2: Enable disruptions on the PDBs for the given disruption window ID
####################################################################

for PDB in $(kubectl get pdb -n "$NAMESPACE" -l "panfactum.com/voluntary-disruption-window-id=$WINDOW_ID" --ignore-not-found -o name); do
  ANNOTATIONS=$(kubectl get "$PDB" -n "$NAMESPACE" -o jsonpath="{.metadata.annotations}")
  MAX_UNAVAILABLE=$(echo "$ANNOTATIONS" | jq -r '.["panfactum.com/voluntary-disruption-window-max-unavailable"]')
  echo "Enabling disruption window for '$PDB' in namespace '$NAMESPACE':" >&2

  if [[ $MAX_UNAVAILABLE == "null" ]]; then
    echo -e "\tWarning: PDB does not have 'panfactum.com/voluntary-disruption-window-max-unavailable' annotation. Defaulting to 1." >&2
    MAX_UNAVAILABLE=1
  elif [[ $MAX_UNAVAILABLE == 0 ]]; then
    echo -e "\tWarning: PDB has 'panfactum.com/voluntary-disruption-window-max-unavailable' annotation set to 0 which is not allowed. Defaulting to 1." >&2
    MAX_UNAVAILABLE=1
  fi

  echo -e "\tUpdating PDB with maxUnavailable=$MAX_UNAVAILABLE" >&2
  kubectl patch "$PDB" -n "$NAMESPACE" --type='json' -p="[{\"op\": \"replace\", \"path\": \"/spec/maxUnavailable\", \"value\": $MAX_UNAVAILABLE}]" >/dev/null
  kubectl annotate "$PDB" -n "$NAMESPACE" "panfactum.com/voluntary-disruption-window-start=$(date +%s)" --overwrite >/dev/null
done
