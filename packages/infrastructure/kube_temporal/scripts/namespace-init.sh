#!/bin/sh
set -e

echo "Waiting for Temporal frontend to be healthy..."
until temporal operator cluster health --address "$TEMPORAL_ADDRESS" >/dev/null 2>&1; do
  echo "Frontend not ready yet, retrying in 5 seconds..."
  sleep 5
done

echo "Temporal frontend is healthy. Creating default namespace..."
temporal operator namespace create default \
  --address "$TEMPORAL_ADDRESS" \
  --retention "${RETENTION_DAYS}d" ||
  echo "Namespace 'default' may already exist, continuing..."

echo "Namespace initialization complete."
