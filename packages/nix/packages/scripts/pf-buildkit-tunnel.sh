#!/usr/bin/env bash

set -eo pipefail

# shellcheck disable=SC1091
source pf-buildkit-validate

####################################################################
# Step 1: Variable parsing
####################################################################

# Initialize our own variables:
ARCH=
PORT=

# Define the function to display the usage
usage() {
  echo "Sets up a network tunnel from the local host to a remote BuildKit server" >&2
  echo "" >&2
  echo "Usage: pf-buildkit-tunnel --arch=<arch> --port=<port>" >&2
  echo "       pf-buildkit-tunnel -a=<arch> -p=<port>" >&2
  echo "" >&2
  echo "--arch: The CPU architecture of the BuildKit instance to connect with" >&2
  echo "--port: The local port to bind the tunnel to" >&2
  echo "" >&2
  echo "<arch>: One of: 'amd64' or 'arm64'" >&2
  exit 1
}

# Parse command line arguments
TEMP=$(getopt -o a:p: --long arch:,port:, -- "$@")

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
  -p | --port)
    PORT="$2"
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
# Step 2: Get the cluster for BuildKit
####################################################################
REPO_VARIABLES=$(pf-get-repo-variables)
BUILDKIT_DIR=$(echo "$REPO_VARIABLES" | jq -r '.buildkit_dir')
BUILDKIT_CONFIG_FILE="$BUILDKIT_DIR/buildkit.json"

if ! [[ -f $BUILDKIT_CONFIG_FILE ]]; then
  echo "No BuildKit configuration file exists at $BUILDKIT_CONFIG_FILE. A superuser must create one by running 'pf-update-buildkit --build'." >&2
  exit 1
fi

CONTEXT=$(jq -r '.cluster' "$BUILDKIT_CONFIG_FILE")
if [[ $CONTEXT == "null" ]]; then
  echo "'cluster' not found in $BUILDKIT_CONFIG_FILE. Cannot connect to BuildKit." >&2
  exit 1
elif ! kubectl config get-contexts "$CONTEXT" >/dev/null 2>&1; then
  echo "'$CONTEXT' not found in kubeconfig. Run pf-update-kube to regenerate kubeconfig." >&2
  exit 1
fi

BASTION=$(jq -r '.bastion' "$BUILDKIT_CONFIG_FILE")
if [[ $CONTEXT == "null" ]]; then
  echo "'bastion' not found in $BUILDKIT_CONFIG_FILE. Cannot connect to BuildKit." >&2
  exit 1
fi

####################################################################
# Step 3: Scale up the BuildKit instance
####################################################################
pf-buildkit-scale-up --only="$ARCH" --wait --context="$CONTEXT"

####################################################################
# Step 4: Get the address of a free instance
####################################################################
ADDRESS=$(pf-buildkit-get-address --arch="$ARCH" --context="$CONTEXT" --omit-protocol)

####################################################################
# Step 5: Run the tunnel
####################################################################
pf-tunnel --bastion="$BASTION" --remote-address="$ADDRESS" --local-port="$PORT"
