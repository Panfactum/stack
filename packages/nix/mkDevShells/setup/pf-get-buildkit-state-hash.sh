#!/usr/bin/env bash

set -eo pipefail

# Purpose: Returns a state hash used to determine if pf-update-buildkit --build needs to be rerun.

SCRIPT_HASH="$(tail -n +2 "$(which pf-update-buildkit)" | md5sum | cut -d" " -f1)"
CONFIG_HASH=""

if [[ -n ${PF_BUILDKIT_DIR} ]]; then
  CONFIG_FILE="$DEVENV_ROOT/$PF_BUILDKIT_DIR/config.yaml"
  if [[ -f $CONFIG_FILE ]]; then
    CONFIG_HASH="$(md5sum "$CONFIG_FILE" | cut -d" " -f1)"
  fi
fi

echo "$SCRIPT_HASH$CONFIG_HASH" | md5sum
