#!/usr/bin/env bash

set -eo pipefail

# (1) remove the first occurrence of "routing-mode"
# b/c the chart authors have a bug that puts it in there incorrectly
# (2) Set the cpu requests to a more reasonable 10m (down from 100m)
cat <&0 \
  | awk '!found && /routing-mode: "tunnel"/ { found=1; next } 1' \
  | sed 's/cpu: 100m/cpu: 10m/g'
