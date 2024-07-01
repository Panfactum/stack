#!/usr/bin/env bash

set -eo pipefail

# Purpose: Adds the BuildKit configuration files

if [ -z "${PF_BUILDKIT_DIR}" ]; then
  echo "Error: PF_BUILDKIT_DIR is not set. Add it to your devenv.nix file." >&2
  exit 1
fi

if [[ $1 == "-b" ]] || [[ $1 == "--build" ]]; then
  BUILD="1"
else
  BUILD="0"
fi

############################################################
## Step 1: Copy the static files
############################################################

DESTINATION=$(realpath "$DEVENV_ROOT/$PF_BUILDKIT_DIR")
SOURCE=$(dirname "$(dirname "$(realpath "$0")")")/files/buildkit

mkdir -p "$DESTINATION"

rsync -rp --chmod=Du=rwx,Dg=rx,Do=rx,Fu=rw,Fg=r,Fo=r "$SOURCE"/ "$DESTINATION"/

############################################################
## Step 2: Update the global configuration
############################################################

CONFIG_FILE="$DESTINATION/config.yaml"
AUTH_FILE="$DESTINATION/config.json"
BUILDKIT_FILE="$DESTINATION/buildkit.json"

if [[ $BUILD == "1" ]]; then
  if [[ -f $CONFIG_FILE ]]; then

    if [[ -z ${PF_ENVIRONMENTS_DIR} ]]; then
      echo "Error: PF_ENVIRONMENTS_DIR is not set. Add it to your devenv.nix file." >&2
      exit 1
    fi

    MODULE=$(yq -r ".module" "$CONFIG_FILE")
    BASTION=$(yq -r ".bastion" "$CONFIG_FILE")
    MODULE_PATH="$DEVENV_ROOT/$PF_ENVIRONMENTS_DIR/$MODULE"

    echo -e "Extracting buildkit configuration from $MODULE...\n" 1>&2
    MODULE_OUTPUT="$(terragrunt output --json --terragrunt-working-dir="$MODULE_PATH")"
    echo -e "Generating config file...\n" 1>&2

    ECR_REGISTRY="$(echo "$MODULE_OUTPUT" | jq -r '.ecr_registry.value')"
    CLUSTER_NAME="$(echo "$MODULE_OUTPUT" | jq -r '.eks_cluster_name.value')"
    CACHE_BUCKET_NAME="$(echo "$MODULE_OUTPUT" | jq -r '.cache_bucket_name.value')"
    CACHE_BUCKET_REGION="$(echo "$MODULE_OUTPUT" | jq -r '.cache_bucket_region.value')"

    cat >"$BUILDKIT_FILE" <<EOF
{
  "registry": "$ECR_REGISTRY",
  "cluster": "$CLUSTER_NAME",
  "cache_bucket": "$CACHE_BUCKET_NAME",
  "cache_bucket_region": "$CACHE_BUCKET_REGION",
  "bastion": "$BASTION",
  "credHelpers": {
    "$ECR_REGISTRY": "panfactum",
    "public.ecr.aws": "panfactum"
  }
}
EOF
  else
    echo "Warning: No configuration file exists at $CONFIG_FILE. Skipping setup..." >&2
  fi
fi
pf-get-buildkit-state-hash >"$DESTINATION/state.lock"

############################################################
## Step 3: Update the user configuration
############################################################

if [[ -f $BUILDKIT_FILE ]]; then
  if [[ ! -f $AUTH_FILE ]]; then
    echo '{}' >"$AUTH_FILE"
  fi
  HELPERS=$(jq '.credHelpers' "$BUILDKIT_FILE")
  UPDATED_CONFIG=$(jq --argjson new "$HELPERS" '.credHelpers += $new' "$AUTH_FILE")
  echo "$UPDATED_CONFIG" >"$AUTH_FILE"
fi
pf-get-buildkit-user-state-hash >"$DESTINATION/state.user.lock"

############################################################
## Step 4: Final checks
############################################################

echo -e "BuildKit config files in $PF_BUILDKIT_DIR were updated.\n" 1>&2

if [[ $PF_SKIP_CHECK_REPO_SETUP != 1 ]]; then
  pf-check-repo-setup
fi
