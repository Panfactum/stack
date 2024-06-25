#!/usr/bin/env bash

set -eo pipefail

# shellcheck disable=SC1091
source pf-buildkit-validate

####################################################################
# Step 1: Variable parsing
####################################################################

# Initialize our own variables:
ARCH=

# Define the function to display the usage
usage() {
  echo "Marks a recorded build on the $BUILDKIT_LAST_BUILD_ANNOTATION_KEY on the BuildKit StatefulSet" >&2
  echo "in order to defer scale down" >&2
  echo "" >&2
  echo "Usage: pf-buildkit-record-build --arch=<arch>" >&2
  echo "       pf-buildkit-record-build -a=<arch>" >&2
  echo "" >&2
  echo "--arch: The CPU architecture of the BuildKit StatefulSet where the build was submitted" >&2
  echo "" >&2
  echo "<arch>: One of: 'amd64' or 'arm64'" >&2
  exit 1
}

# Parse command line arguments
TEMP=$(getopt -o a: --long arch: -- "$@")

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
  -a | --arch)
    ARCH="$2"
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

if [[ -z $ARCH ]] || [[ ! $ARCH =~ ^amd64|arm64$ ]]; then
  echo "--arch must be one of: 'amd64' or 'arm64'" >&2
  exit 1
fi

####################################################################
# Step 2: Record the build
####################################################################

STATEFULSET_NAME="$BUILDKIT_STATEFULSET_NAME_PREFIX$ARCH"
kubectl annotate \
  statefulset "$STATEFULSET_NAME" \
  --namespace="$BUILDKIT_NAMESPACE" \
  "$BUILDKIT_LAST_BUILD_ANNOTATION_KEY"="$(date +%s)" \
  --overwrite
