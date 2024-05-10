#!/usr/bin/env bash

set -eo pipefail

# Purpose: Sets up kubeconfig for use in connecting with kubernetes clusters

if [[ -z ${PF_KUBE_DIR} ]]; then
  echo "Error: PF_KUBE_DIR is not set. Add it to your devenv.nix file." >&2
  exit 1
fi

if [[ -z ${PF_AWS_DIR} ]]; then
  echo "Error: PF_AWS_DIR is not set. Add it to your devenv.nix file." >&2
  exit 1
fi

if [[ $1 == "-b" ]] || [[ $1 == "--build" ]]; then
  BUILD_CONFIG="1"
else
  BUILD_CONFIG="0"
fi

############################################################
## Step 1: Copy the static files
############################################################

destination=$(realpath "$DEVENV_ROOT/$PF_KUBE_DIR")
source=$(dirname "$(dirname "$(realpath "$0")")")/files/kube

mkdir -p "$destination"

rsync -rp --chmod=Du=rwx,Dg=rx,Do=rx,Fu=rw,Fg=r,Fo=r "$source"/ "$destination"/

############################################################
## Step 2: Build the cluster_info file
############################################################
CONFIG_FILE="$DEVENV_ROOT/$PF_KUBE_DIR/config.yaml"
CLUSTER_INFO_FILE="$DEVENV_ROOT/$PF_KUBE_DIR/cluster_info"

if [[ $BUILD_CONFIG -eq 1 ]]; then

  if [[ -f $CONFIG_FILE ]]; then
    echo -e "\nBuilding cluster_info file...\n " >&2

    # Remove any existing cluster_info file
    if [[ -f $CLUSTER_INFO_FILE ]]; then
      rm -rf "$CLUSTER_INFO_FILE"
    fi

    # Count the number of clusters
    NUMBER_OF_CLUSTERS=$(yq '.clusters | length' "$CONFIG_FILE")

    if [[ $NUMBER_OF_CLUSTERS -eq 0 ]]; then
      echo "Error: 'clusters' not specified in $CONFIG_FILE!" >&2
      exit 1
    fi

    # Iterate over each cluster
    for ((i = 0; i < NUMBER_OF_CLUSTERS; i++)); do

      # Extract config values
      MODULE=$(yq -r ".clusters[$i].module" "$CONFIG_FILE")
      MODULE_PATH="$DEVENV_ROOT/$PF_ENVIRONMENTS_DIR/$MODULE"

      echo "Adding cluster at $PF_ENVIRONMENTS_DIR/$MODULE... " >&2

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

      # Hash the CA data
      CA_HASH="$(echo "$CA_DATA" | md5sum | cut -d" " -f1)"

      # Add cluster info to the cluster_info file
      echo "$CLUSTER_NAME $CLUSTER_REGION $CLUSTER_URL $CA_HASH" >>"$CLUSTER_INFO_FILE"

      echo -e "Done!\n" >&2
    done

    # Save the state hash
    pf-get-kube-state-hash >"$DEVENV_ROOT/$PF_KUBE_DIR/state.lock"

    echo -e "cluster_info updated!\n" >&2
    echo -e "-----------------------------------------------------------" >&2
  else
    echo "Error: No configuration file exists at $CONFIG_FILE. See https://panfactum.com/docs/reference/configuration/kubernetes." >&2
    exit 1
  fi
fi

############################################################
## Step 3: Dynamically configure user-specific kubeconfig
############################################################

USER_CONFIG_FILE="$DEVENV_ROOT/$PF_KUBE_DIR/config.user.yaml"

if [[ -f $CLUSTER_INFO_FILE ]]; then

  if [[ -f $USER_CONFIG_FILE ]]; then

    echo -e "\nBuilding kubeconfig file at $PF_KUBE_DIR/config...\n" >&2

    # Count the number of clusters
    NUMBER_OF_CLUSTERS=$(yq '.clusters | length' "$USER_CONFIG_FILE")

    if [[ $NUMBER_OF_CLUSTERS -eq 0 ]]; then
      echo "Error: 'clusters' not specified in $USER_CONFIG_FILE!" >&2
      exit 1
    fi

    # Iterate over each cluster
    for ((i = 0; i < NUMBER_OF_CLUSTERS; i++)); do

      # Extract name and aws_profile for the current cluster
      CLUSTER_NAME=$(yq -r ".clusters[$i].name" "$USER_CONFIG_FILE")
      AWS_PROFILE=$(yq -r ".clusters[$i].aws_profile" "$USER_CONFIG_FILE")

      if [[ $CLUSTER_NAME == "null" ]]; then
        echo "Error: 'name' not specified for entry cluster.$i in $USER_CONFIG_FILE!" >&2
        exit 1
      elif [[ $AWS_PROFILE == "null" ]]; then
        echo "Error: 'aws_profile' not specified for entry clusters.$i in $USER_CONFIG_FILE!" >&2
        exit 1
      fi

      echo "Adding $CLUSTER_NAME using $AWS_PROFILE for authentication... " >&2

      # Validate the AWS profile
      if ! aws configure list-profiles | grep -Fxq "$AWS_PROFILE"; then
        echo "Error: AWS profile $AWS_PROFILE does not exist. Ensure this name is correct or have a superuser run 'pf-update-aws --build' to regenerate your AWS profiles." >&2
        exit 1
      fi

      # Extract the cluster info
      read -r CLUSTER_REGION CLUSTER_URL <<<"$(grep -m 1 "$CLUSTER_NAME " "$CLUSTER_INFO_FILE" | awk '{print $2, $3}')"
      if [[ -z $CLUSTER_REGION || -z $CLUSTER_URL ]]; then
        echo "Error: $CLUSTER_NAME not found in $CLUSTER_INFO_FILE. Ensure this name is correct or have a superuser run 'pf-update-kube --build' to regenerate this file." >&2
        exit 1
      fi

      CA_DATA_FILE="$DEVENV_ROOT/$PF_KUBE_DIR/$CLUSTER_NAME.crt"

      if [[ ! -f $CA_DATA_FILE ]]; then
        echo "Error: No CA cert found at $CA_DATA_FILE. Have a superuser run 'pf-update-kube --build' to regenerate this file." >&2
        exit 1
      fi

      # Setup kubeconfig
      kubectl config set-credentials "$CLUSTER_NAME" \
        --exec-api-version "client.authentication.k8s.io/v1beta1" \
        --exec-command pf-get-kube-token \
        --exec-arg --region,"$CLUSTER_REGION",--cluster-name,"$CLUSTER_NAME",--profile,"$AWS_PROFILE" \
        >/dev/null

      kubectl config set-cluster "$CLUSTER_NAME" \
        --server "$CLUSTER_URL" \
        --certificate-authority "$CA_DATA_FILE" \
        --embed-certs \
        >/dev/null

      kubectl config set-context "$CLUSTER_NAME" \
        --user "$CLUSTER_NAME" \
        --cluster "$CLUSTER_NAME" \
        >/dev/null

      echo -e "Done!\n" >&2
    done

    echo -e "All clusters configured!\n" >&2
  else
    echo -e "\nWarning: No configuration file exists at $USER_CONFIG_FILE. Skipping kubeconfig setup!\n" >&2
  fi
else
  echo -e "\nWarning: No cluster_info file exists at $CLUSTER_INFO_FILE. A superuser must run 'pf-update-kube --build' to generate this file. Skipping kubeconfig setup!\n" >&2
fi

# Save the state hash
pf-get-kube-user-state-hash >"$DEVENV_ROOT/$PF_KUBE_DIR/state.user.lock"

echo -e "-----------------------------------------------------------" >&2

echo -e "\nKubernetes config files in $PF_KUBE_DIR were updated." 1>&2

pf-check-repo-setup
