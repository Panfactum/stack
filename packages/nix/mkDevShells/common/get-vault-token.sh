#!/usr/bin/env bash

# This script is intended to support
# Vault authentication during terraform workflows

set -eo pipefail

export VAULT_ADDR="${1:-$VAULT_ADDR}"

function login() {

  if [[ $CI == "true" ]]; then
    # This is specific to the kube_gha_arc_runners module
    TOKEN=$(vault write \
      --format=json \
      auth/kubernetes/login \
      role=arc-runners \
      jwt=@/var/run/secrets/kubernetes.io/serviceaccount/token |
      jq -r .auth.client_token)
  else
    TOKEN=$(vault login -method=oidc -field=token)
  fi

  print_token "$TOKEN"
}

function print_token() {
  # In the CI system, we never want to print the token to stdout directly.
  # Instead, we want to mask it and save it to an environment variable.
  if [[ $CI == "true" ]]; then
    echo "::add-mask::$1"
    echo "VAULT_TOKEN=$1" >>"$GITHUB_ENV"
  else
    echo "$1"
  fi
}

# Allow disabling this for use in our terragrunt config
# when we don't have vault enabled
if [[ $VAULT_ADDR == "@INVALID@" ]]; then
  exit 0
fi

# Allow overriding via the VAULT_TOKEN env var
if [[ -n $VAULT_TOKEN ]]; then
  print_token "$VAULT_TOKEN"
else

  # Utilize the vault credential helper to pull the credential
  # from disk if it exists; if it doesn't exist, do a login
  TOKEN=$(vault print token)
  if [[ -n $TOKEN ]]; then

    # If the token will expire in less than 30 minutes,
    # we need to get a new one (or if we cannot authenticate against
    # vault with the current token at all)
    set +e
    TTL="$(vault token lookup -format=json | jq -r '.data.ttl')"
    set -e

    # shellcheck disable=SC2181
    if [[ $? != 0 || $TTL -lt "1800" ]]; then
      login
    else
      print_token "$TOKEN"
    fi
  else
    login
  fi
fi
