#!/usr/bin/env bash

# This script is intended to support getting db credentials from Vault

set -eo pipefail

ROLE=${1:-"MISSING"}

VAULT_TOKEN=$(pf-get-vault-token)
export VAULT_TOKEN

vault read "db/creds/$ROLE"
