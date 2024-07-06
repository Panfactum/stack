#!/usr/bin/env bash

set -eo pipefail

# Utility function to return a random open port

# Search for a free PORT by checking if the port is used
START_PORT=$((RANDOM % 9001 + 1024))
for PORT in $(seq $START_PORT $((START_PORT + 100)) | shuf); do
  if ! lsof "-iTCP@127.0.0.1:$PORT" -sTCP:LISTEN -n -P >/dev/null; then
    echo "$PORT"
    break
  fi
done
