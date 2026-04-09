#!/usr/bin/env bash

set -eo pipefail

# Utility function to return the AWS profile to use when operating with BuildKit

CONTEXT=$1

if [[ -z $CONTEXT ]]; then
  echo "pf-get-aws-profile-for-kube-context must be called with a cluster name as the first and only argument." >&2
  exit 1
fi

REPO_VARIABLES=$(pf-get-repo-variables)
KUBE_DIR=$(echo "$REPO_VARIABLES" | jq -r '.kube_dir')
KUBE_USER_CONFIG_FILE="$KUBE_DIR/config.user.yaml"

if [[ ! -f $KUBE_USER_CONFIG_FILE ]]; then
  echo "Error: $KUBE_USER_CONFIG_FILE does not exist. It is required to set this up before interacting with BuildKit." >&2
  exit 1
fi

if ! kubectl config get-contexts "$CONTEXT" >/dev/null 2>&1; then
  echo "'$CONTEXT' not found in kubeconfig. Run pf-update-kube to regenerate kubeconfig." >&2
  exit 1
fi

AWS_PROFILE=$(yq -r ".clusters[] | select(.name == \"$CONTEXT\") | .aws_profile" "$KUBE_USER_CONFIG_FILE")

if [[ $AWS_PROFILE == "null" ]]; then
  echo "Error: AWS profile not configured for cluster $CONTEXT. Add cluster to $KUBE_USER_CONFIG_FILE." >&2
  exit 1
fi

echo "$AWS_PROFILE"
