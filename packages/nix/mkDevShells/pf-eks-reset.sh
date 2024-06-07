#!/usr/bin/env bash

# This script is intended to remove the default resources that AWS installs in an EKS
# cluster so that we can install our hardened replacements. Unfortunately, this is not
# possible via tf so we create this convenience script to run as a part of the bootstrapping
# guide

set -eo pipefail

####################################################################
# Step 0: Validation
####################################################################

if [[ -z $PF_KUBE_DIR ]]; then
  echo "PF_KUBE_DIR is not set. Add it to your devenv.nix file." >&2
  exit 1
fi

USER_CONFIG_FILE="$DEVENV_ROOT/$PF_KUBE_DIR/config.user.yaml"
if [[ ! -f $USER_CONFIG_FILE ]]; then
  echo "Error: No configuration file found at $USER_CONFIG_FILE. Create it first!" >&2
  exit 1
fi

CLUSTER_INFO_FILE="$DEVENV_ROOT/$PF_KUBE_DIR/cluster_info"
if [[ ! -f $CLUSTER_INFO_FILE ]]; then
  echo "Error: No cluster_info file found at $CLUSTER_INFO_FILE. Create it with 'pf-update-kube --build' first!" >&2
  exit 1
fi

if [[ ! -f $KUBE_CONFIG_PATH ]]; then
  echo "Error: No kubeconfig file found at $KUBE_CONFIG_PATH. Create it with 'pf-update-kube' first!" >&2
  exit 1
fi

####################################################################
# Step 1: Select the cluster
####################################################################

CLUSTER=$(kubectl config get-contexts -o name | fzf --prompt="Select a Kubernetes cluster: ")

####################################################################
# Step 2: Confirmation
####################################################################

echo -e "You selected: $CLUSTER\n" >&2
echo -e "WARNING: This will reset core cluster utilities. This should only be done as a part of cluster bootstrapping.\n" >&2
read -rp "Enter name of cluster to confirm: " CONFIRM_CLUSTER

if [ "$CLUSTER" != "$CONFIRM_CLUSTER" ]; then
  echo -e "$CONFIRM_CLUSTER does not match $CLUSTER. Exiting.\n" >&2
  exit 1
fi

####################################################################
# Step 3: Select the AWS profile
####################################################################

AWS_PROFILE=$(yq -r '.clusters[] | select(.name == "'"$CLUSTER"'") | .aws_profile' "$USER_CONFIG_FILE")

if [[ -z $AWS_PROFILE ]]; then
  echo "Error: AWS profile $AWS_PROFILE not found in $USER_CONFIG_FILE" >&2
  exit 1
fi

####################################################################
# Step 4: Get the cluster region
####################################################################

read -r CLUSTER_REGION <<<"$(grep -m 1 "$CLUSTER_NAME " "$CLUSTER_INFO_FILE" | awk '{print $2}')"

####################################################################
# Step 5: Delete the addons (using the AWS API)
####################################################################

ADDONS=$(aws --profile "$AWS_PROFILE" eks list-addons --cluster-name "$CLUSTER")

function delete_addon() {
  if echo "$ADDONS" | grep -q "$1"; then
    aws \
      --profile "$AWS_PROFILE" \
      --region "$CLUSTER_REGION" \
      eks delete-addon \
      --cluster-name "$CLUSTER" \
      --addon-name "$1" \
      --no-preserve \
      2>/dev/null
    echo "EKS addon disabled: $1" >&2
  else
    echo "EKS addon not enabled: $1" >&2
  fi
}

delete_addon coredns
delete_addon kube-proxy
delete_addon vpc-cni

####################################################################
# Step 6: Delete any lingering resources in the cluster itself
####################################################################

function kubectl_delete() {
  kubectl \
    --context "$CLUSTER" \
    -n "kube-system" \
    delete "$1" "$2" \
    --ignore-not-found
}

kubectl_delete deployment coredns
kubectl_delete service kube-dns
kubectl_delete configmap coredns
kubectl_delete daemonset aws-node
kubectl_delete configmap amazon-vpc-cni
kubectl_delete daemonset kube-proxy
kubectl_delete configmap kube-proxy
kubectl_delete configmap kube-proxy-config
kubectl_delete configmap aws-auth
kubectl --context "$CLUSTER" delete storageclass gp2 --ignore-not-found

####################################################################
# Step 7: Terminate all nodes so old node-local configuration settings are wiped
####################################################################

TAG_KEY="kubernetes.io/cluster/$CLUSTER"
TAG_VALUE="owned"

# Get the instance IDs of all instances with the specified tag
INSTANCE_IDS=$(aws \
  --profile "$AWS_PROFILE" \
  --region "$CLUSTER_REGION" \
  ec2 describe-instances \
  --filters "Name=tag:$TAG_KEY,Values=$TAG_VALUE" "Name=instance-state-name,Values=pending,running,stopping,stopped" \
  --query "Reservations[*].Instances[*].InstanceId" \
  --output text |
  tr '\n' ' ')

# Check if there are any instances to terminate
if [[ -z $INSTANCE_IDS ]]; then
  echo "No nodes to terminate" >&2
else
  # INSTANCE_IDS is intentionally left unquoted
  # shellcheck disable=SC2086
  aws --profile "$AWS_PROFILE" --region "$CLUSTER_REGION" ec2 terminate-instances --instance-ids $INSTANCE_IDS 2>/dev/null
  echo "Nodes terminated to reset node-local settings." >&2
fi
