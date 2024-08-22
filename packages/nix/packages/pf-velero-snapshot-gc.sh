#!/usr/bin/env bash

set -eo pipefail

####################################################################
# Step 1: Variable parsing
####################################################################

# Define the function to display the usage
usage() {
  echo "Removes VolumeSnapshots and VolumeSnapshotContents that have been orphaned by Velero"
  echo "Usage: pf-velero-snapshot-gc " >&2
}

####################################################################
# Step 2: Perform the garbage collection
####################################################################

# Function to check if a Velero backup exists
backup_exists() {
  local backup_name=$1
  kubectl get backup.velero.io "$backup_name" -n velero --ignore-not-found
}

VOLUME_SNAPSHOTS=$(kubectl get volumesnapshot -o json -A | jq -r '.items[] | [.metadata.namespace, .metadata.name, .metadata.labels."velero.io/backup-name", .status.boundVolumeSnapshotContentName] | @tsv')

while IFS=$'\t' read -r NAMESPACE SNAPSHOT BACKUP_NAME SNAPSHOT_CONTENT; do

  if [[ $BACKUP_NAME == "null" ]]; then
    continue
  elif [[ -n $(backup_exists "$BACKUP_NAME") ]]; then
    echo "Backup $BACKUP_NAME exists. Skipping VolumeSnapshot $SNAPSHOT..." >&2
    continue
  fi

  echo "Backup $BACKUP_NAME does not exist. Deleting VolumeSnapshot $SNAPSHOT..." >&2

  # If a VolumeSnapshotContent is associated, ensure that it is set up to delete the backing volume
  # We do this first, b/c deleting the VolumeSnapshot may delete the VolumeSnapshotContent
  if [[ -n $SNAPSHOT_CONTENT ]]; then
    kubectl patch volumesnapshotcontent "$SNAPSHOT_CONTENT" --type=merge -p '{"spec": {"deletionPolicy": "Delete"}}' >/dev/null
  fi

  # Delete the VolumeSnapshot
  # We delete the VolumeSnapshot first b/c of finalizers that can cause delay if VolumeSnapshotContent is deleted before the VolumeSnapshot
  kubectl delete -n "$NAMESPACE" volumesnapshot "$SNAPSHOT" --ignore-not-found >/dev/null

  # Try to delete the VSC, in case it did not happen automatically
  if [[ -n $SNAPSHOT_CONTENT ]]; then
    kubectl delete volumesnapshotcontent "$SNAPSHOT_CONTENT" --ignore-not-found >/dev/null
  fi

done <<<"$VOLUME_SNAPSHOTS"
