#!/usr/bin/env bash

# Implements this spec: https://github.com/docker/docker-credential-helpers
# in order to aid in ECR login
#
# Note that we do not implement the store or list commands.

set -eo pipefail

COMMAND="${1:-get}"
REGISTRY="$(</dev/stdin)"

####################################################################
# Step 1: Validation
####################################################################

if [[ -z ${PF_BUILDKIT_DIR} ]]; then
  echo "Error: PF_BUILDKIT_DIR is not set. Add it to your devenv.nix file." >&2
  exit 1
fi

if [[ -z ${PF_KUBE_DIR} ]]; then
  echo "Error: PF_KUBE_DIR is not set. Add it to your devenv.nix file." >&2
  exit 1
fi

if [[ $REGISTRY == "public.ecr.aws" ]]; then
  AWS_REGION="us-east-1" # public-ecr is in us-east-1 always
elif [[ $REGISTRY =~ ^([^.]+)\.dkr\.ecr\.([^.]+)\.amazonaws\.com$ ]]; then
  AWS_REGION="${BASH_REMATCH[2]}"
else
  echo "Error: The Panfactum credential helper can only be used for ECR registries"
  exit 1
fi

BUILDKIT_CONFIG_FILE="$DEVENV_ROOT/$PF_BUILDKIT_DIR/buildkit.json"

if [[ ! -f $BUILDKIT_CONFIG_FILE ]]; then
  echo "Error: $BUILDKIT_CONFIG_FILE does not exist. A superuser must run 'pf-update-buildkit --build' to generate."
  exit 1
fi

CONTEXT=$(jq -r '.cluster' "$BUILDKIT_CONFIG_FILE")
if [[ $CONTEXT == "null" ]]; then
  echo "'cluster' not found in $BUILDKIT_CONFIG_FILE. A superuser must run 'pf-update-buildkit --build' to generate." >&2
  exit 1
fi
AWS_PROFILE=$(pf-get-aws-profile-for-kube-context "$CONTEXT")

####################################################################
# Step 2: Command Execution
####################################################################

CREDS_FILE="$DEVENV_ROOT/$PF_BUILDKIT_DIR/creds.json"

if [[ $COMMAND == "get" ]]; then

  # Attempts to retrieves a fresh token from the AWS API
  function get_new_token() {
    aws --profile "$AWS_PROFILE" --region "$AWS_REGION" ecr get-login-password 2>&1
  }

  # Prints the credential payload in the format expected by the calling tool
  function output() {
    echo "{\"Username\": \"AWS\", \"Secret\": \"$1\"}"
  }

  # Saves a retrieved token from the filesystem cache
  function save() {
    if [[ ! -f $CREDS_FILE ]]; then
      echo '{}' >"$CREDS_FILE"
    fi
    jq --arg registry "$REGISTRY" --arg token "$1" --arg expires "$(date -d "4 hours" +%s)" '.[$registry] = {"token": $token, "expires": $expires}' "$CREDS_FILE" \
      >"$DEVENV_ROOT/$PF_BUILDKIT_DIR/tmp.json" &&
      mv "$DEVENV_ROOT/$PF_BUILDKIT_DIR/tmp.json" "$CREDS_FILE"
  }

  # Attempts to retrieve a token from the filesystem cache
  function get_saved_token() {
    if ! [[ -f $CREDS_FILE ]]; then
      exit 1
    fi
    local EXPIRES
    EXPIRES=$(jq --arg registry "$REGISTRY" '.[$registry].expires')
    if [[ $EXPIRES == "null" ]] || [[ $(date +%s) -ge $EXPIRES ]]; then
      exit 1
    fi
    jq --arg registry "$REGISTRY" '.[$registry].token'
  }

  # First, attempt to get the token from cache
  if TOKEN=$(get_saved_token); then
    output "$TOKEN"
  fi

  # Then, if no token could be retrieved locally, get a new one from the remote API
  #
  # Note that if we attempt to retrieve a new token, we automatically attempt to resolve
  # SSO failures to improve the user ergonomics
  if ! TOKEN=$(get_new_token); then
    if echo "$TOKEN" | grep -q "Error loading SSO Token: Token for $AWS_PROFILE does not exist"; then
      aws --profile "$AWS_PROFILE" sso login >&2
      TOKEN=$(get_new_token)
    elif echo "$TOKEN" | grep -q "Error when retrieving token from sso: Token has expired and refresh failed"; then
      aws --profile "$AWS_PROFILE" sso logout >&2
      aws --profile "$AWS_PROFILE" sso login >&2
      TOKEN=$(get_new_token)
    else
      echo -e "$TOKEN" >&2
      exit 1
    fi
  fi

  save "$TOKEN"
  output "$TOKEN"
elif [[ $COMMAND == "erase" ]]; then
  jq --arg registry "$REGISTRY" '.[$registry] = {}' "$CREDS_FILE" \
    >"$DEVENV_ROOT/$PF_BUILDKIT_DIR/tmp.json" &&
    mv "$DEVENV_ROOT/$PF_BUILDKIT_DIR/tmp.json" "$CREDS_FILE"
fi
