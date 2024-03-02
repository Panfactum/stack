#!/usr/bin/env bash

set -eo pipefail

# This script is meant to be used in our GHA runners to release
# the terraform locks that they might be holding in the event that they
# are terminated before they can release the locks themselves

WHO="runner@$(hostname)"
ITEMS=$(aws dynamodb scan --table-name "$TF_LOCK_TABLE" | jq -c ".Items[] | select( if .Info.S then (.Info.S | fromjson).Who == \"$WHO\" else false end )")

echo "$ITEMS" | jq -c ".LockID.S" | while read -r id; do
  echo "Deleting item with LockID: $id"

  # Delete item by Id
  aws dynamodb delete-item \
    --table-name YourTableName \
    --key "{\"LockID\": {\"S\": $id}}"
done
