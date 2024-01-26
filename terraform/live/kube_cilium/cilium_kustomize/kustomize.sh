#!/usr/bin/env bash

set -eo pipefail

SCRIPT=$(realpath "$0")
SCRIPTPATH=$(dirname "$SCRIPT")

# save incoming YAML to file
cat <&0 > "$SCRIPTPATH/all.yaml"

# (1) Set the cpu requests to a more reasonable 10m (down from 100m)
cat "$SCRIPTPATH/all.yaml" \
  | sed 's/cpu: 100m/cpu: 10m/g'

rm -f "$SCRIPTPATH/all.yaml"
