#!/usr/bin/env bash

# This script makes sure that the bastions are properly configured and ready to use

set -eo pipefail

if [ -z "${PF_SSH_DIR}" ]; then
  echo "Error: PF_SSH_DIR is not set. Add it to your devenv.nix file." >&2
  exit 1
fi

CONFIG_FILE="$DEVENV_ROOT/$PF_SSH_DIR/config.yaml"
if [[ ! -f $CONFIG_FILE ]]; then
  echo "Error: No configuration file found at $CONFIG_FILE." >&2
  exit 1
fi

CONNECTION_INFO_FILE="$DEVENV_ROOT/$PF_SSH_DIR/connection_info"
if [[ ! -f $CONNECTION_INFO_FILE ]]; then
  echo "Error: No connection_info file found at $CONNECTION_INFO_FILE. Run pf-update-ssh to generate this file." >&2
  exit 1
fi

KNOWN_HOSTS_FILE="$DEVENV_ROOT/$PF_SSH_DIR/known_hosts"
if [[ ! -f $KNOWN_HOSTS_FILE ]]; then
  echo "Error: No known_hosts file found at $KNOWN_HOSTS_FILE. Run pf-update-ssh to generate this file." >&2
  exit 1
fi
