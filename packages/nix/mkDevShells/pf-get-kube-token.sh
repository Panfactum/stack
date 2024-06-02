#!/usr/bin/env bash

# This script is intended to support getting an EKS auth token
# We use this thin wrapper over the AWS CLI as
# users of the Panfactum stack seem to get confused about needing to run aws sso login prior
# to attempting to interact with EKS clusters

####################################################################
# Step 1: Variable parsing
####################################################################
REGION=""
CLUSTER_NAME=""
AWS_PROFILE=""

usage() {
  echo "Usage: pf-get-kube-token -r <region> -c <cluster-name> -p <aws-profile>" >&2
  echo "       pf-get-db-creds --region <region> --cluster-name <cluster-name> --profile <aws-profile>" >&2
  echo "" >&2
  echo "<region>: The AWS region of the EKS cluster" >&2
  echo "" >&2
  echo "<cluster-name>: The name of the EKS cluster" >&2
  echo "" >&2
  echo "<profile>: The AWS profile to use for authentication" >&2
  exit 1
}

# Parse command line arguments
TEMP=$(getopt -o r:c:p: --long cluster-name:,region:,profile: -- "$@")

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
  -r | --region)
    REGION="$2"
    shift 2
    ;;
  -c | --cluster-name)
    CLUSTER_NAME="$2"
    shift 2
    ;;
  -p | --profile)
    AWS_PROFILE="$2"
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

if [[ -z $REGION ]]; then
  echo "region is a required argument." >&2
  exit 1
elif [[ -z $CLUSTER_NAME ]]; then
  echo "cluster-name is a required argument." >&2
  exit
elif [[ -z $AWS_PROFILE ]]; then
  echo "profile is a required argument." >&2
  exit 1
fi

####################################################################
# Step 2: Get EKS token
####################################################################

function get_token() {
  aws \
    --region "$REGION" \
    --profile "$AWS_PROFILE" \
    eks get-token \
    --cluster-name "$CLUSTER_NAME" \
    --output json 2>&1
}

RESPONSE=$(get_token)

# shellcheck disable=SC2181
if [[ $? -eq 0 ]]; then
  echo -e "$RESPONSE"
else
  if echo "$RESPONSE" | grep -q "Error loading SSO Token: Token for $AWS_PROFILE does not exist"; then
    aws --profile "$AWS_PROFILE" sso login >&2
    get_token
  elif echo "$RESPONSE" | grep -q "Error when retrieving token from sso: Token has expired and refresh failed"; then
    aws --profile "$AWS_PROFILE" sso logout >&2
    aws --profile "$AWS_PROFILE" sso login >&2
    get_token
  else
    echo -e "$RESPONSE" >&2
    exit 1
  fi
fi
