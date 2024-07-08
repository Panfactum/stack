#!/usr/bin/env bash

set -eo pipefail

# shellcheck disable=SC1091
source pf-buildkit-validate

####################################################################
# Step 1: Variable parsing
####################################################################
CONTEXT=

# Define the function to display the usage
usage() {
  echo "Deletes the idle cache from all BuildKit instances." >&2
  echo "" >&2
  echo "Usage: pf-buildkit-clear-cache" >&2
  echo "" >&2
  echo "--context:  The kubectl context to use for interacting with Kubernetes" >&2
  exit 1
}

# Parse command line arguments
TEMP=$(getopt -o c: --long context: -- "$@")

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
  -c | --context)
    CONTEXT="$2"
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

if [[ -n $CONTEXT ]]; then
  if ! kubectl config get-contexts "$CONTEXT" >/dev/null 2>&1; then
    echo "'$CONTEXT' not found in kubeconfig." >&2
    exit 1
  fi
  CONTEXT_ARGS="--context=$CONTEXT"
else
  CONTEXT_ARGS=""
fi

####################################################################
# Step 2: Delete the PVCs that are not in use
####################################################################

# Get all BuildKit PVCs
# shellcheck disable=SC2086
PVCS=$(
  kubectl \
    get pvc \
    $CONTEXT_ARGS \
    --namespace buildkit \
    --output jsonpath='{.items[*].metadata.name}'
)

# Loop through each PVC
for PVC in $PVCS; do

  # Check if the PVC is used by any pod
  # shellcheck disable=SC2086
  POD_USAGE=$(
    kubectl get pods \
      --namespace buildkit \
      $CONTEXT_ARGS \
      -o json |
      jq \
        --arg pvc "$PVC" \
        '.items[] | select(.spec.volumes[]?.persistentVolumeClaim.claimName == $pvc)'
  )

  # If the PVC is not used by any pod, delete it
  if [[ -z $POD_USAGE ]]; then
    echo "Deleting unused PVC: $PVC" >&2
    # shellcheck disable=SC2086
    kubectl delete pvc "$PVC" --namespace buildkit $CONTEXT_ARGS --wait=false
  else
    echo "PVC in use: $PVC" >&2
  fi
done

####################################################################
# Step 3: Exec into pods and delete the mounted caches
####################################################################
# shellcheck disable=SC2086
PODS=$(
  kubectl get pods \
    -n buildkit \
    $CONTEXT_ARGS \
    -o jsonpath='{range .items[*]}{.metadata.name} {.status.phase}{"\n"}{end}'
)

# Loop through each pod and run the command
while read -r POD STATUS; do
  if [[ $STATUS == "Running" ]] && [[ $POD =~ buildkit.+ ]]; then
    echo "Pruning cache in running BuildKit pod: $POD" >&2
    # shellcheck disable=SC2086
    kubectl exec "$POD" \
      -c buildkitd \
      -n buildkit \
      $CONTEXT_ARGS \
      -- buildctl prune --all \
      >/dev/null
  fi
done <<<"$PODS"
