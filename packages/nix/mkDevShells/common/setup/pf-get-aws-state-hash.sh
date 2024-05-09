#!/usr/bin/env bash

set -eo pipefail

# Purpose: Returns a state hash used to determine if pf-update-aws --build needs to be rerun.

SCRIPT_HASH="$(tail -n +2 "$(which pf-update-aws)" | md5sum | cut -d" " -f1)"
CONFIG_HASH=""

if [[ -n ${PF_AWS_DIR} ]]; then
  CONFIG_FILE="$DEVENV_ROOT/$PF_AWS_DIR/config.yaml"
  if [[ -f $CONFIG_FILE ]]; then
    CONFIG_HASH="$(md5sum "$CONFIG_FILE" | cut -d" " -f1)"
  fi
fi

echo "$SCRIPT_HASH$CONFIG_HASH" | md5sum
