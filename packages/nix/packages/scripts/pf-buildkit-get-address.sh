#!/usr/bin/env bash

set -eo pipefail

# shellcheck disable=SC1091
source pf-buildkit-validate

####################################################################
# Step 1: Variable parsing
####################################################################

# Initialize our own variables:
ARCH=
CONTEXT=
OMIT_PROTOCOL=0

# Define the function to display the usage
usage() {
  echo "Returns the internal cluster TCP address of the BuildKit instances with the least CPU usage" >&2
  echo "" >&2
  echo "Usage: pf-buildkit-get-address --arch=<arch> [--context=<kubectl-context>] [--omit-protocol]" >&2
  echo "       pf-buildkit-get-address -a=<arch> [-c=<kubectl-context>] [-o]" >&2
  echo "" >&2
  echo "--arch:           The CPU architecture of BuildKit to use. For building multi-arch container images." >&2
  echo "--context:        The kubectl context to use for interacting with Kubernetes" >&2
  echo "--omit-protocol:  If specified, will not include the network protocol in the returned address." >&2
  echo "" >&2
  echo "<arch>: One of: 'amd64' or 'arm64'" >&2
  exit 1
}

# Parse command line arguments
TEMP=$(getopt -o a:c:o --long arch:,context:,omit-protocol, -- "$@")

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
  -c | --context)
    CONTEXT="$2"
    shift 2
    ;;
  -o | --omit-protocol)
    OMIT_PROTOCOL=1
    shift 1
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
# Step 2: Get the address
####################################################################

# Note that if the pod was just started, `pods.metrics.k8s.io` might not exist for the pod yet.
# Instead of creating an error, we put those pods at the TOP of the sort b/c that means they likely have not received any builds yet
# shellcheck disable=SC2086
POD=$(kubectl \
  get pods \
  -n "$BUILDKIT_NAMESPACE" \
  $CONTEXT_ARGS \
  -o=jsonpath='{range .items[?(@.status.phase=="Running")]}{.metadata.name}{"\n"}' |
  head -n -1 |
  grep "$ARCH" |
  while read -r podname; do
    echo "$podname $(kubectl get pods.metrics.k8s.io -n "$BUILDKIT_NAMESPACE" "$podname" 2>/dev/null | tail -n +2 | awk '{print $2}')"
  done | sort -k2 -n | head -n1 | awk '{print $1}')

# shellcheck disable=SC2086
IP=$(
  kubectl \
    get pod "$POD" \
    -n "$BUILDKIT_NAMESPACE" \
    $CONTEXT_ARGS \
    -o=jsonpath='{.status.podIP}' |
    tr '.' '-'
)

if [[ $OMIT_PROTOCOL == 1 ]]; then
  echo "$IP.$BUILDKIT_NAMESPACE.pod.cluster.local:1234"
else
  echo "tcp://$IP.$BUILDKIT_NAMESPACE.pod.cluster.local:1234"
fi
