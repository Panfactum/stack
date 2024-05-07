#!/usr/bin/env bash

set -eo pipefail

# Purpose: Returns a state hash used to determine if pf-update-kube needs to be rerun.

SCRIPT_HASH="$(md5sum "$(which pf-update-kube)" | cut -d" " -f1)"
CLUSTER_INFO_HASH=""
USER_CONFIG_HASH=""

if [[ -n ${PF_KUBE_DIR} ]]; then
  CLUSTER_INFO_FILE="$DEVENV_ROOT/$PF_KUBE_DIR/cluster_info"
  if [[ -f $CLUSTER_INFO_FILE ]]; then
    CLUSTER_INFO_HASH="$(md5sum "$CLUSTER_INFO_FILE" | cut -d" " -f1)"
  fi

  USER_CONFIG_FILE="$DEVENV_ROOT/$PF_KUBE_DIR/config.user.yaml"
  if [[ -f $USER_CONFIG_FILE ]]; then
    USER_CONFIG_HASH="$(md5sum "$USER_CONFIG_FILE" | cut -d" " -f1)"
  fi
fi

echo "$SCRIPT_HASH$USER_CONFIG_HASH$CLUSTER_INFO_HASH" | md5sum
