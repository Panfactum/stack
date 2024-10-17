#!/usr/bin/env bash

set -eo pipefail

# Purpose: Returns a state hash used to determine if pf-update-buildkit needs to be rerun.

BUILDKIT_DIR=$(pf-get-repo-variables | jq -r '.buildkit_dir')
SCRIPT_HASH="$(tail -n +2 "$(which pf-update-buildkit)" | md5sum | cut -d" " -f1)"
BUILD_HASH=""

if [[ -d $BUILDKIT_DIR ]]; then
  BUILD_HASH_FILE="$BUILDKIT_DIR/state.lock"
  if [[ -f $BUILD_HASH_FILE ]]; then
    BUILD_HASH="$(md5sum "$BUILD_HASH_FILE" | cut -d" " -f1)"
  fi
fi

echo "$SCRIPT_HASH$BUILD_HASH" | md5sum
