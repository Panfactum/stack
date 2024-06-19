#!/usr/bin/env bash

# This script is intended to support
# Vault authentication during terraform workflows

set -eo pipefail

export VAULT_ADDR="${1:-$VAULT_ADDR}"

####################################################################
# Step 1: Variable parsing
####################################################################
ADDRESS=""
SILENT=0
NOOP=0

usage() {
  echo "Usage: pf-get-vault-token [-a <vault-address>] [-s] [-n]" >&2
  echo "       pf-get-vault-token [--address <vault-address>] [--silent] [--noop]" >&2
  echo "" >&2
  echo "<vault-address>: The URL of the Vault cluster. Defaults to VAULT_ADDR if not set." >&2
  echo "" >&2
  echo "--silent: Exit with 0 if failing to get the vault token." >&2
  echo "" >&2
  echo "--noop: Exit with 0 immediately (used by terragrunt to skip execution if provider is not enabled)" >&2
  exit 1
}

# Parse command line arguments
TEMP=$(getopt -o a:sn --long address:,silent,noop -- "$@")

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
  -a | --address)
    ADDRESS="$2"
    shift 2
    ;;
  -s | --silent)
    SILENT=1
    shift 1
    ;;
  -n | --noop)
    NOOP=1
    shift 1
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

if [[ $NOOP == 1 ]]; then
  exit 0
fi

# Force a clean exit if --silent is enabled
if [[ $SILENT == 1 ]]; then
  handle_exit() {
    # shellcheck disable=SC2181
    if [[ $? != 0 ]]; then

      # Don't pollute terragrunt logs if vault isn't initialized yet
      if [[ $VAULT_ADDR != "@@TERRAGRUNT_INVALID@@" ]]; then
        echo "Warning: pf-get-vault-token failed, but exiting with 0 as --silent is enabled." >&2
      fi

      echo "invalid_token"
    fi
    exit 0
  }
  trap 'handle_exit' EXIT
fi

if [[ -z $ADDRESS ]]; then
  if [[ -z $VAULT_ADDR ]]; then
    echo "VAULT_ADDR is not set. Either set the env variable or use the --address flag." >&2
    exit 1
  fi
else
  VAULT_ADDR="$ADDRESS"
fi

# Provide a special error message for use in terragrunt to aid
# users in debugging
if [[ $VAULT_ADDR == "@@TERRAGRUNT_INVALID@@" ]]; then
  if [[ $SILENT == 0 ]]; then
    echo "Error: Vault provider is enabled by vault_addr is not set." >&2
  fi
  exit 1
fi

export VAULT_ADDR

####################################################################
# Step 2: Get the Vault token
####################################################################

function login() {
  TOKEN=$(vault login -method=oidc -field=token)
  print_token "$TOKEN"
}

function print_token() {
  echo "$1"
}

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
