#!/usr/bin/env bash

# This script returns the address of the running buildkit pod with the least cpu usage

set -eo pipefail

NAMESPACE=buildkit

POD=$(kubectl get pods -n "$NAMESPACE" -o=jsonpath='{range .items[?(@.status.phase=="Running")]}{.metadata.name}{"\n"}' | head -n -1 | while read -r podname; do
  echo "$podname $(kubectl get podmetrics -n "$NAMESPACE" "$podname" | tail -n +2 | awk '{print $2}')"
done | sort -k2 -n | head -n1 | awk '{print $1}')

IP=$(kubectl get pod "$POD" -n "$NAMESPACE" -o=jsonpath='{.status.podIP}' | tr '.' '-')

echo "tcp://$IP.$NAMESPACE.pod.cluster.local:1234"
