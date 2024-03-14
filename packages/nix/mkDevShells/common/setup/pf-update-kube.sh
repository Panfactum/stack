#!/usr/bin/env bash

set -eo pipefail

# Purpose: Adds the standard .ssh configuration files

if [ -z "${PF_KUBE_DIR}" ]; then
  echo "Error: PF_KUBE_DIR is not set. Add it to your devenv.nix file." >&2
  exit 1
fi

############################################################
## Step 1: Copy the static files
############################################################

destination=$(realpath "$DEVENV_ROOT/$PF_KUBE_DIR")
source=$(dirname "$(dirname "$(realpath "$0")")")/files/kube

mkdir -p "$destination"

rsync -rp --chmod=Du=rwx,Dg=rx,Do=rx,Fu=rw,Fg=r,Fo=r "$source"/ "$destination"/

############################################################
## Step 2: Dynamically configure kubeconfig
############################################################

USER_CONFIG_FILE="$DEVENV_ROOT/$PF_KUBE_DIR/config.user.yaml"

if [[ -f $USER_CONFIG_FILE ]]; then

  if [[ -z ${PF_ENVIRONMENTS_DIR} ]]; then
    echo "Error: PF_ENVIRONMENTS_DIR is not set. Add it to your devenv.nix file." >&2
    exit 1
  fi

  # Count the number of clusters
  NUMBER_OF_CLUSTERS=$(yq '.clusters | length' "$USER_CONFIG_FILE")

  # Iterate over each cluster
  for ((i = 0; i < NUMBER_OF_CLUSTERS; i++)); do

    # Extract module and aws_profile for the current cluster
    MODULE=$(yq -r ".clusters[$i].module" "$USER_CONFIG_FILE")
    AWS_PROFILE=$(yq -r ".clusters[$i].aws_profile" "$USER_CONFIG_FILE")
    MODULE_PATH="$DEVENV_ROOT/$PF_ENVIRONMENTS_DIR/$MODULE"

    echo "Using $AWS_PROFILE authentication information for cluster at $MODULE_PATH... " >&2

    if [[ ! -d $MODULE_PATH ]]; then
      echo "Error: No module at $MODULE_PATH!" >&2
      exit 1
    fi

    # Extract the module outputs
    MODULE_OUTPUT="$(terragrunt output --json --terragrunt-working-dir="$MODULE_PATH")"
    CA_DATA="$(echo "$MODULE_OUTPUT" | jq -r '.cluster_ca_data.value' | base64 -d)"
    CLUSTER_URL="$(echo "$MODULE_OUTPUT" | jq -r '.cluster_url.value')"
    CLUSTER_NAME="$(echo "$MODULE_OUTPUT" | jq -r '.cluster_name.value')"
    CLUSTER_REGION="$(echo "$MODULE_OUTPUT" | jq -r '.cluster_region.value')"

    # Save the CA data
    CA_DATA_FILE="$DEVENV_ROOT/$PF_KUBE_DIR/$CLUSTER_NAME.crt"
    echo "$CA_DATA" >"$CA_DATA_FILE"

    # Setup kubeconfig
    kubectl config set-credentials "$CLUSTER_NAME" \
      --exec-api-version "client.authentication.k8s.io/v1beta1" \
      --exec-command aws \
      --exec-arg --region,"$CLUSTER_REGION",eks,get-token,--cluster-name,"$CLUSTER_NAME",--output,json --exec-env AWS_PROFILE="$AWS_PROFILE"

    kubectl config set-cluster "$CLUSTER_NAME" \
      --server "$CLUSTER_URL" \
      --certificate-authority "$CA_DATA_FILE" \
      --embed-certs

    kubectl config set-context "$CLUSTER_NAME" \
      --user "$CLUSTER_NAME" \
      --cluster "$CLUSTER_NAME"

  done

else
  echo "Warning: No configuration file exists at $USER_CONFIG_FILE. Skipping credential setup..." >&2
fi

# Save the state hash
pf-get-kube-state-hash >"$DEVENV_ROOT/$PF_KUBE_DIR/state.lock"

echo "Kubernetes config files in $PF_KUBE_DIR were updated." 1>&2
