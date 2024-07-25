#!/usr/bin/env bash

set -eo pipefail

# Purpose: Returns a state hash used to determine if pf-update-ssh --build needs to be rerun.

SSH_DIR=$(pf-get-repo-variables | jq -r '.ssh_dir')
SCRIPT_HASH="$(tail -n +2 "$(which pf-update-ssh)" | md5sum | cut -d" " -f1)"
CONFIG_HASH=""

if [[ -n ${SSH_DIR} ]]; then
  CONFIG_FILE="$SSH_DIR/config.yaml"
  if [[ -f $CONFIG_FILE ]]; then
    CONFIG_HASH="$(md5sum "$CONFIG_FILE" | cut -d" " -f1)"
  fi
fi

echo "$SCRIPT_HASH$CONFIG_HASH" | md5sum
