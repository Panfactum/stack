#!/usr/bin/env bash

set -eo pipefail

source pf-buildkit-validate

####################################################################
# Step 1: Variable parsing
####################################################################

# Initialize our own variables:
ARCH=

# Define the function to display the usage
usage() {
  echo "Returns the internal cluster TCP address of the BuildKit instances with the least CPU usage" >&2
  echo "" >&2
  echo "Usage: pf-buildkit-get-address --arch=<arch>" >&2
  echo "       pf-buildkit-get-address -arch=<arch>" >&2
  echo "" >&2
  echo "--arch: The CPU architecture of BuildKit to use. For building multi-arch container images." >&2
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
# Step 2: Get the address
####################################################################

POD=$(kubectl get pods -n "$BUILDKIT_NAMESPACE" -o=jsonpath='{range .items[?(@.status.phase=="Running")]}{.metadata.name}{"\n"}' | head -n -1 | grep "$ARCH" | while read -r podname; do
  echo "$podname" >&2
  echo "$podname $(kubectl get pods.metrics.k8s.io -n "$BUILDKIT_NAMESPACE" "$podname" | tail -n +2 | awk '{print $2}')"
done | sort -k2 -n | head -n1 | awk '{print $1}')

IP=$(kubectl get pod "$POD" -n "$BUILDKIT_NAMESPACE" -o=jsonpath='{.status.podIP}' | tr '.' '-')

echo "tcp://$IP.$BUILDKIT_NAMESPACE.pod.cluster.local:1234"
