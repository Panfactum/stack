#!/usr/bin/env bash

set -eo pipefail

if [[ $LOGGING_ENABLED -eq 1 ]]; then
  exec 3>&2 # Duplicate stderr to file descriptor 3
else
  exec 3>/dev/null # Redirect file descriptor 3 to /dev/null
fi

while true; do

  # Fetch ACL rules from source Redis
  echo "Fetching ACL rules from master Redis instance ($SRC_REDIS_HOST)..." >&3
  ACL_RULES_SRC=$(redis-cli -e -h "$SRC_REDIS_HOST" ACL LIST | grep -oP '^user \K.+')
  if [[ -z $ACL_RULES_SRC ]]; then
    echo "Failed to fetch ACL rules from master Redis instance." >&3
    exit 1
  fi

  # Extract the list of users from the source ACL rules
  USERS_SRC=$(echo "$ACL_RULES_SRC" | grep -oP '^\S+')

  # Ensure that the kubernetes users managed by VSO exist. If not, force recreate them by deleting their creds secrets.
  if ! echo "$USERS_SRC" | grep -q "V_KUBERNETES-${REDIS_NAMESPACE^^}-${REDIS_STS_NAME^^}_SUPERUSER"; then
    echo "VSO superuser user does not exist. Recreating..." >&3
    kubectl -n "$REDIS_NAMESPACE" delete secret "$REDIS_STS_NAME-superuser-creds" >/dev/null
    sleep 5
    continue
  elif ! echo "$USERS_SRC" | grep -q "V_KUBERNETES-${REDIS_NAMESPACE^^}-${REDIS_STS_NAME^^}_ADMIN"; then
    echo "VSO admin user does not exist. Recreating..." >&3
    kubectl -n "$REDIS_NAMESPACE" delete secret "$REDIS_STS_NAME-admin-creds" >/dev/null
    sleep 5
    continue
  elif ! echo "$USERS_SRC" | grep -q "V_KUBERNETES-${REDIS_NAMESPACE^^}-${REDIS_STS_NAME^^}_READER"; then
    echo "VSO reader user does not exist. Recreating..." >&3
    kubectl -n "$REDIS_NAMESPACE" delete secret "$REDIS_STS_NAME-reader-creds" >/dev/null
    sleep 5
    continue
  fi

  # Syncs the users and ACLs from the master to the replica / sentinel
  function sync_acl() {

    POD=$1
    PORT=$2

    TYPE="replica"
    if [[ $PORT -eq 26379 ]]; then
      TYPE="sentinel"
    fi

    echo "Syncing ACL from master to $TYPE ($POD)..." >&3

    DST_REDIS_HOST=$(kubectl -n "$REDIS_NAMESPACE" get pod "$POD" -o jsonpath='{.status.podIP}')

    # Fetch ACL rules from dest Redis
    echo -e "\tFetching ACL rules..." >&3
    ACL_RULES_DST=$(redis-cli -e -h "$DST_REDIS_HOST" -p "$PORT" ACL LIST | grep -oP '^user \K.+')

    if [[ -z $ACL_RULES_DST ]]; then
      echo -e "\tFailed to fetch ACL rules from $TYPE instance." >&3
      exit 1
    fi

    # Extract the list of users from the dest ACL rules
    USERS_DST=$(echo "$ACL_RULES_DST" | grep -oP '^\S+')

    echo -e "\tDeleting old users..." >&3

    # Find users that exist in the dest Redis but not in the source Redis and delete them
    for USER in $USERS_DST; do
      if ! echo "$USERS_SRC" | grep -qw "$USER"; then
        redis-cli -e -h "$DST_REDIS_HOST" -p "$PORT" ACL DELUSER "$USER" >/dev/null
      fi
    done

    # Apply ACL rules from master Redis to dest Redis
    echo -e "\tApplying ACL rules..." >&3
    while IFS= read -r RULE; do
      # shellcheck disable=SC2086
      redis-cli -e -h "$DST_REDIS_HOST" -p "$PORT" ACL SETUSER $RULE >/dev/null
    done <<<"$ACL_RULES_SRC"

    echo -e "\tSynchronization finished." >&3
  }

  # Sync to all replicas
  for REPLICA_POD in $(kubectl -n "$REDIS_NAMESPACE" get pods -l id="$REDIS_ID",isMaster!=true --field-selector=status.phase=Running -o custom-columns=:metadata.name --no-headers); do
    sync_acl "$REPLICA_POD" 6379
  done

  # Sync to all sentinels
  for SENTINEL_POD in $(kubectl -n "$REDIS_NAMESPACE" get pods -l id="$REDIS_ID" --field-selector=status.phase=Running -o custom-columns=:metadata.name --no-headers); do
    sync_acl "$SENTINEL_POD" 26379
  done

  echo "Sleeping for 60 seconds..." >&3
  sleep 60
done
