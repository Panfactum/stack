#!/usr/bin/env bash

set -eo pipefail

# Utility function to return a random open port

# Get a list of all used ports
# On MacOS, use netstat -tan instead of ss

if command -v ss &> /dev/null; then
  USED_PORTS=$(ss -tan | awk 'NR>1 {print $4}' | awk -F':' '{print $NF}' | sort -n | uniq)
elif command -v netstat &> /dev/null; then
  USED_PORTS=$(netstat -tan | awk 'NR>2 {print $4}' | awk -F':' '{print $NF}' | sort -n | uniq)
else
  echo "Error: ss or netstat not found"
  exit 1
fi

# Search for a free PORT by checking against the list of used ports
START_PORT=$((RANDOM % 9001 + 1024))
for PORT in $(seq $START_PORT $((START_PORT + 100)) | shuf); do
  if ! echo "$USED_PORTS" | grep -q "^$PORT$"; then
    echo "$PORT"
    break
  fi
done
