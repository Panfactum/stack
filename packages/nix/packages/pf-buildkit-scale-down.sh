#!/usr/bin/env bash

set -eo pipefail

source pf-buildkit-validate

####################################################################
# Step 1: Variable parsing
####################################################################

# Initialize our own variables:
TIMEOUT=

# Define the function to display the usage
usage() {
  echo "Scales the BuildKit instances to 0 replicas." >&2
  echo "" >&2
  echo "Usage: pf-buildkit-scale-down [--timeout=<seconds-since-last-build>]" >&2
  echo "       pf-buildkit-scale-down [-t=<seconds-since-last-build>]" >&2
  echo "" >&2
  echo "--timeout: If provided, will examine the annotation $BUILDKIT_LAST_BUILD_ANNOTATION_KEY" >&2
  echo "           on each BuildKit StatefulSet and will only scale the StatefulSet down if <seconds-since-last-build>" >&2
  echo "           has elapsed. This prevents scale-down from occurring during an active build." >&2
  echo "           If not provided, will scale down immediately." >&2
  exit 1
}

# Parse command line arguments
TEMP=$(getopt -o t: --long timeout: -- "$@")

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
  -t | --timeout)
    TIMEOUT="$2"
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

if [[ -n $TIMEOUT ]] && [[ ! $TIMEOUT =~ ^[0-9]+$ ]]; then
  echo >&2 "Please provide a valid numeric argument for --timeout"
  exit 1
fi

####################################################################
# Step 2: Scale up the buildkits
####################################################################

function scale-down() {
  local ARCH=$1
  local STATEFULSET_NAME="$BUILDKIT_STATEFULSET_NAME_PREFIX$ARCH"
  local CURRENT_TIME
  local LAST_BUILD
  CURRENT_TIME=$(date +%s)
  LAST_BUILD=$(kubectl get statefulset "$STATEFULSET_NAME" --namespace="$BUILDKIT_NAMESPACE" -o=go-template="{{index .metadata.annotations \"$ANNOTATION_KEY\"}}")
  echo "$ARCH: The last recorded build was: $LAST_BUILD" >&2
  if [[ -z $LAST_BUILD || $LAST_BUILD == "<no value>" ]]; then
    echo "$ARCH: No builds recorded. Scaling down..." >&2
    kubectl scale statefulset "$STATEFULSET_NAME" --namespace="$BUILDKIT_NAMESPACE" --replicas=0
  elif [[ $((CURRENT_TIME - LAST_BUILD)) -gt $TIMEOUT ]]; then
    echo "$ARCH: Last build occurred over $TIMEOUT seconds ago. Scaling down..." >&2
    kubectl scale statefulset "$STATEFULSET_NAME" --namespace="$BUILDKIT_NAMESPACE" --replicas=0
  else
    echo "$ARCH: Last build occurred less than $TIMEOUT seconds ago. Skipping scale down." >&2
  fi
}

scale-down "amd64"
scale-down "arm64"
