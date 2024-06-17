#!/usr/bin/env bash

# This script will patch all pdbs managed by the cnpg operator to allow primary disruption

set -eo pipefail

kubectl get pdb --all-namespaces -o json | jq -r \
  '.items[] |
   select(.metadata.annotations["cnpg.io/operatorVersion"]? != null) |
   "\(.metadata.namespace) \(.metadata.name) \(.metadata.ownerReferences? != null)"' |
  while read -r namespace name has_owner_references; do
    # Delete owner references if they exist
    if [ "$has_owner_references" = "true" ]; then
      kubectl patch pdb "$name" -n "$namespace" --type='json' -p='[{"op": "remove", "path": "/metadata/ownerReferences"}]'
    fi

    # Set minAvailable to 0
    kubectl patch pdb "$name" -n "$namespace" --type='json' -p='[{"op": "replace", "path": "/spec/minAvailable", "value":0}]'
  done
