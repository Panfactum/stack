#!/usr/bin/env bash

# This script is intended to support getting db credentials from Vault

set -eo pipefail

####################################################################
# Step 1: Variable parsing
####################################################################
ROLE=""

# Define the function to display the usage
usage() {
  echo "Usage: pf-get-db-creds -r <role> [-a <vault-address>]" >&2
  echo "       pf-get-db-creds --role <role> [--vault-address <vault-address>]" >&2
  echo "" >&2
  echo "<vault-address>: (Optional) The Vault address to connect to." >&2
  exit 1
}

# Parse command line arguments
TEMP=$(getopt -o a:r: --long vault-address:,role: -- "$@")

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
  -a | --vault-address)
    VAULT_ADDR="$2"
    shift 2
    ;;
  -r | --role)
    ROLE="$2"
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

if [[ -z $ROLE ]]; then
  echo "role is a required argument." >&2
  exit 1
fi

export VAULT_ADDR

####################################################################
# Step 2: Get DB Credentials
####################################################################

VAULT_TOKEN=$(pf-get-vault-token)
export VAULT_TOKEN

vault read "db/creds/$ROLE"
