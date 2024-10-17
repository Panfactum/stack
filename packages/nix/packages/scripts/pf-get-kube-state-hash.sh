#!/usr/bin/env bash

set -eo pipefail

# Purpose: Returns a state hash used to determine if pf-update-kube --build needs to be rerun.

KUBE_DIR=$(pf-get-repo-variables | jq -r '.kube_dir')
SCRIPT_HASH="$(tail -n +2 "$(which pf-update-kube)" | md5sum | cut -d" " -f1)"
CONFIG_HASH=""

if [[ -d $KUBE_DIR ]]; then
  CONFIG_FILE="$KUBE_DIR/config.yaml"
  if [[ -f $CONFIG_FILE ]]; then
    CONFIG_HASH="$(md5sum "$CONFIG_FILE" | cut -d" " -f1)"
  fi
fi

echo "$SCRIPT_HASH$CONFIG_HASH" | md5sum
