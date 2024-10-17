#!/usr/bin/env bash

set -eo pipefail

# shellcheck disable=SC1091
source pf-buildkit-validate

####################################################################
# Step 1: Variable parsing
####################################################################

# Initialize our own variables:
ONLY_ARCH=
WAIT=0
CONTEXT=

# Define the function to display the usage
usage() {
  echo "Scales up BuildKit from 0. Helper to be used prior to a build."
  echo "Usage: pf-buildkit-scale-up [--only=<arch>] [--context=<kubectl-context>] [--wait]" >&2
  echo "       pf-buildkit-scale-up [-o=<arch>] [-c=<kubectl-context>] [-w]" >&2
  echo "" >&2
  echo "--wait:     If provided, will wait up to 10 minutes for the scale-up to complete before exiting." >&2
  echo "--context:  The kubectl context to use for interacting with Kubernetes" >&2
  echo "--only:     If provided, will only only scale up the BuildKit instance for the provided architecture." >&2
  echo "            Otherwise, will scale up all architectures." >&2
  echo "" >&2
  echo "<arch>: One of: 'amd64' or 'arm64'" >&2
  exit 1
}

# Parse command line arguments
TEMP=$(getopt -o o:c:w --long only:,context:,wait -- "$@")

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
  -o | --only)
    ONLY_ARCH="$2"
    shift 2
    ;;
  -w | --wait)
    WAIT=1
    shift 1
    ;;
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

if [[ -n $ONLY_ARCH ]] && [[ ! $ONLY_ARCH =~ ^amd64|arm64$ ]]; then
  echo "--only must be one of: 'amd64' or 'arm64'" >&2
  exit 1
fi

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
# Step 2: Scale up the buildkits
####################################################################

function scale-up() {
  local ARCH=$1
  local STATEFULSET_NAME="$BUILDKIT_STATEFULSET_NAME_PREFIX$ARCH"
  local CURRENT_REPLICAS
  CURRENT_REPLICAS=$(
    # shellcheck disable=SC2086
    kubectl \
      get statefulset "$STATEFULSET_NAME" \
      --namespace="$BUILDKIT_NAMESPACE" \
      $CONTEXT_ARGS \
      -o=jsonpath='{.spec.replicas}'
  )
  if [[ $CURRENT_REPLICAS -eq 0 ]]; then
    # shellcheck disable=SC2086
    kubectl \
      scale statefulset "$STATEFULSET_NAME" \
      --namespace="$BUILDKIT_NAMESPACE" \
      $CONTEXT_ARGS \
      --replicas=1
  fi
  # We record a scale-up as a "build" so that our autoscaler does not attempt to scale down
  # buildkit between the scale-up and the build initiating.
  # shellcheck disable=SC2086
  pf-buildkit-record-build $CONTEXT_ARGS --arch="$ARCH"
}

if [[ -n $ONLY_ARCH ]]; then
  scale-up "$ONLY_ARCH"
else
  scale-up "arm64"
  scale-up "amd64"
fi

####################################################################
# Step 3: Wait for scale-up to complete
####################################################################

TIMEOUT=600 # 10 minutes in seconds
START_TIME=$(date +%s)
ELAPSED_TIME=0
COUNTDOWN=0
function get-available-replica-count() {
  local ARCH=$1
  # shellcheck disable=SC2086
  kubectl \
    $CONTEXT_ARGS \
    get statefulset "$BUILDKIT_STATEFULSET_NAME_PREFIX$ARCH" \
    --namespace="$BUILDKIT_NAMESPACE" \
    -o=jsonpath='{.status.availableReplicas}'
}

function wait-for-scale-up() {
  local AVAILABLE_REPLICAS=0
  local ARCH=$1
  while true; do
    AVAILABLE_REPLICAS=$(get-available-replica-count "$ARCH")
    if [[ $AVAILABLE_REPLICAS -ge 1 ]]; then
      break
    fi
    CURRENT_TIME=$(date +%s)
    ELAPSED_TIME=$((CURRENT_TIME - START_TIME))
    COUNTDOWN=$((TIMEOUT - ELAPSED_TIME))
    echo "$ARCH: Waiting $COUNTDOWN seconds for at least one BuildKit replica to become available..." >&2

    if [[ $ELAPSED_TIME -ge $TIMEOUT ]]; then
      echo "$ARCH: Timeout reached while waiting for StatefulSet $BUILDKIT_STATEFULSET_NAME_PREFIX$ARCH to scale up." >&2
      exit 1
    fi
    sleep 10
  done
}

if [[ $WAIT == 1 ]]; then
  if [[ -n $ONLY_ARCH ]]; then
    wait-for-scale-up "$ONLY_ARCH"
  else
    wait-for-scale-up "arm64"
    wait-for-scale-up "amd64"
  fi
fi
