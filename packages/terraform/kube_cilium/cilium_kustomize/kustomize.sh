#!/usr/bin/env bash

set -eo pipefail

SCRIPT=$(realpath "$0")
SCRIPT_PATH=$(dirname "$SCRIPT")

# save incoming YAML to file
cat >"$SCRIPT_PATH/all.yaml"

# (1) Set the cpu requests to a more reasonable 10m (down from 100m)
sed 's/cpu: 100m/cpu: 10m/g' <"$SCRIPT_PATH/all.yaml"

rm -f "$SCRIPT_PATH/all.yaml"
