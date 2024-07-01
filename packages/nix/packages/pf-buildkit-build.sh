#!/usr/bin/env bash

set -emo pipefail

# shellcheck disable=SC1091
source pf-buildkit-validate

####################################################################
# Step 1: Variable parsing
####################################################################

# Initialize our own variables:
REPO=
TAG=
DOCKERFILE=
BUILD_CONTEXT=

# Define the function to display the usage
usage() {
  echo "Submits a multi-platform container build to BuildKit" >&2
  echo "" >&2
  echo "Usage: pf-buildkit-build --repo=<image-repo> --tag=<image-tag> --file=<dockerfile> --context=<context> ..." >&2
  echo "       pf-buildkit-build -r=<image-repo> -t=<image-tag> -f=<dockerfile> -c=<context> ..." >&2
  echo "" >&2
  echo "--repo:     The name of the repository in the ECR container registry" >&2
  echo "--tag:      The tag for the generated image" >&2
  echo "--file:     Path to the Dockerfile to use for the build" >&2
  echo "--context:  Path to the build context" >&2
  echo "" >&2
  echo "...:        Extra arguments will be forwarded to buildctl" >&2
  exit 1
}

# This is our hacky way to capture arguments that should be passed through to
# buildctl. This isn't pretty but bash doesn't have many options for this.
PASS_THRU=()
for ARG in "$@"; do
  if [[ ! $ARG =~ -[trcf]=.+ ]] && [[ ! $ARG =~ --(repo|tag|file|context)=.+ ]]; then
    PASS_THRU+=("$ARG")
  fi
done

# Parse command line arguments but don't error b/c we allow
# arbitrary arguments as we pass them through to buildctl
set +e
TEMP=$(getopt -q -o r:t:f:c: --long repo:,tag:,file:,context: -- "$@")
set -e

# Note the quotes around `$TEMP`: they are essential!
eval set -- "$TEMP"

# Extract options and their arguments into variables
while true; do
  case "$1" in
  -r | --repo)
    REPO="$2"
    shift 2
    ;;
  -t | --tag)
    TAG="$2"
    shift 2
    ;;
  -c | --context)
    BUILD_CONTEXT="$2"
    shift 2
    ;;
  -f | --file)
    DOCKERFILE="$2"
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

if [[ -z $REPO ]]; then
  echo "Error: --repo must be specified" >&2
  exit 1
fi

if [[ -z $TAG ]]; then
  echo "Error: --tag must be specified" >&2
  exit 1
fi

if [[ -z $BUILD_CONTEXT ]]; then
  echo "Error: --context must be specified" >&2
  exit 1
fi

if [[ -z $DOCKERFILE ]]; then
  echo "Error: --file must be specified" >&2
  exit 1
fi

####################################################################
# Step 2: Extract variables from the BuildKit configuration
####################################################################
BUILDKIT_DIR="$DEVENV_ROOT/$PF_BUILDKIT_DIR"
BUILDKIT_CONFIG_FILE="$BUILDKIT_DIR/buildkit.json"

if ! [[ -f $BUILDKIT_CONFIG_FILE ]]; then
  echo "No BuildKit configuration file exists at $BUILDKIT_CONFIG_FILE. A superuser must create one by running 'pf-update-buildkit --build'." >&2
  exit 1
fi

REGISTRY=$(jq -r '.registry' "$BUILDKIT_CONFIG_FILE")
if [[ $REGISTRY == "null" ]]; then
  echo "'registry' not found in $BUILDKIT_CONFIG_FILE. Cannot push images." >&2
  exit 1
fi

CACHE_BUCKET=$(jq -r '.cache_bucket' "$BUILDKIT_CONFIG_FILE")
if [[ $CACHE_BUCKET == "null" ]]; then
  echo "'cache_bucket' not found in $BUILDKIT_CONFIG_FILE. Cannot use BuildKit." >&2
  exit 1
fi

CACHE_BUCKET_REGION=$(jq -r '.cache_bucket_region' "$BUILDKIT_CONFIG_FILE")
if [[ $CACHE_BUCKET_REGION == "null" ]]; then
  echo "'cache_bucket_region' not found in $BUILDKIT_CONFIG_FILE. Cannot use BuildKit." >&2
  exit 1
fi

####################################################################
# Step 3: Start the tunnels
####################################################################

# Cleans up the background processes if the main script
# is exited so we do not leave dangling resources
cleanup() {
  set +eo pipefail
  echo "Closing build processes..." >&2

  # Note that we exit the build processes (if they exist)
  # before we close the tunnels so that they can gracefully exit
  if [[ -n $ARM_BUILD_PID ]]; then
    kill -SIGINT -"$AMD_BUILD_PID" 2>/dev/null
  fi

  if [[ -n $AMD_BUILD_PID ]]; then
    kill -SIGINT -"$AMD_BUILD_PID" 2>/dev/null
  fi

  if [[ -n $ARM_BUILD_PID ]]; then
    wait "$ARM_BUILD_PID"
  fi

  if [[ -n $AMD_BUILD_PID ]]; then
    wait "$AMD_BUILD_PID"
  fi

  # Note that since autossh forks and auto-restarts
  # we need to track the current process PID via a
  # pidfile
  if [[ -f "$BUILDKIT_DIR/arm.pid" ]]; then
    kill -SIGTERM "$(cat "$BUILDKIT_DIR/arm.pid")"
  fi

  if [[ -f "$BUILDKIT_DIR/amd.pid" ]]; then
    kill -SIGTERM "$(cat "$BUILDKIT_DIR/amd.pid")"
  fi

  if [[ -n $ARM_TUNNEL_PID ]]; then
    kill -- -"$ARM_TUNNEL_PID" 2>/dev/null
  fi

  if [[ -n $AMD_TUNNEL_PID ]]; then
    kill -- -"$AMD_TUNNEL_PID" 2>/dev/null
  fi
}
trap cleanup EXIT SIGINT SIGTERM

ARM_PORT=$(pf-get-open-port)
export AUTOSSH_PIDFILE="$BUILDKIT_DIR/arm.pid"
pf-buildkit-tunnel --arch=arm64 --port="$ARM_PORT" &
ARM_TUNNEL_PID=$!

AMD_PORT=$(pf-get-open-port)
export AUTOSSH_PIDFILE="$BUILDKIT_DIR/amd.pid"
pf-buildkit-tunnel --arch=amd64 --port="$AMD_PORT" &
AMD_TUNNEL_PID=$!

####################################################################
# Step 4: Submit the builds
####################################################################

function build() {
  local ARCH=$1
  local PORT
  local PID

  # Determine the port
  if [[ $ARCH == "amd64" ]]; then
    PORT=$AMD_PORT
  else
    PORT=$ARM_PORT
  fi

  # Wait until the tunnel is opened
  while ! nc -z 127.0.0.1 "$PORT" 2>/dev/null; do
    sleep 1
  done

  # Executes the builds in the background so we
  # can run both at once
  env BUILDKIT_HOST="tcp://127.0.0.1:$PORT" \
    buildctl \
    build \
    --frontend=dockerfile.v0 \
    --output "type=image,name=$REGISTRY/$REPO:$TAG-$ARCH,push=true" \
    --local context="$BUILD_CONTEXT" \
    --local dockerfile="$(dirname "$DOCKERFILE")" \
    --opt filename="./$(basename "$DOCKERFILE")" \
    --export-cache "type=s3,region=$CACHE_BUCKET_REGION,bucket=$CACHE_BUCKET,name=$REGISTRY/$REPO" \
    --import-cache "type=s3,region=$CACHE_BUCKET_REGION,bucket=$CACHE_BUCKET,name=$REGISTRY/$REPO" \
    --progress plain \
    "${PASS_THRU[@]}" \
    2>&1 | sed "s/^/$1: /" 1>&2 &

  # Save the PID for cleanup and waiting
  PID=$!
  if [[ $ARCH == "amd64" ]]; then
    AMD_BUILD_PID=$PID
  else
    ARM_BUILD_PID=$PID
  fi
}

# Executes the builds
build amd64
build arm64

# Wait for the builds to complete
wait "$AMD_BUILD_PID"
AMD_BUILD_PID=
wait "$ARM_BUILD_PID"
ARM_BUILD_PID=

####################################################################
# Step 5: Create the multi-platform manifest
####################################################################

manifest-tool \
  push from-args \
  --platforms linux/amd64,linux/arm64 \
  --template "${REGISTRY}/${REPO}:${TAG}-ARCH" \
  --target "${REGISTRY}/${REPO}:${TAG}"
