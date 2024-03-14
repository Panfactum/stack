#!/usr/bin/env bash

set -eo pipefail

# Purpose: Returns a state hash used to determine if pf-update-kube needs to be rerun.

SCRIPT_HASH="$(md5sum "$(which pf-update-kube)")"
CONFIG_HASH=""

if [[ -n ${PF_KUBE_DIR} ]]; then
  CONFIG_FILE="$DEVENV_ROOT/$PF_KUBE_DIR/config.user.yaml"
  if [[ -f $CONFIG_FILE ]]; then
    CONFIG_HASH="$(md5sum "$CONFIG_FILE")"
  fi
fi

echo "$SCRIPT_HASH$CONFIG_HASH" | md5sum
