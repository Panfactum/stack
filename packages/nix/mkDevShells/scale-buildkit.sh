#!/usr/bin/env bash

# This script records start times of builds submitted to our buildkit instances (--record-build)
# Additionally, it can be used to attempt to scale the buildkit instance to 0 if there have not been
# any builds recently (--attempt-scale-down)
# Additionally, it can scale up buildkit from 0 if needed prior to a build (--turn-on). It will
# wait until there is at least one available replica before terminating.

set -eo pipefail

NAMESPACE="buildkit"
STATEFULSET_NAME="buildkit"
ANNOTATION_KEY="panfactum.com/last-build"

case $1 in
--record-build)
  TIMESTAMP=$(date +%s)
  kubectl annotate statefulset $STATEFULSET_NAME --namespace=$NAMESPACE $ANNOTATION_KEY="$TIMESTAMP" --overwrite
  ;;

--turn-on)
  CURRENT_REPLICAS=$(kubectl get statefulset $STATEFULSET_NAME --namespace=$NAMESPACE -o=jsonpath='{.spec.replicas}')
  if [[ $CURRENT_REPLICAS -eq 0 ]]; then
    kubectl scale statefulset $STATEFULSET_NAME --namespace=$NAMESPACE --replicas=1
  fi
  TIMEOUT=600 # 10 minutes in seconds
  START_TIME=$(date +%s)

  while true; do
    AVAILABLE_REPLICAS=$(kubectl get statefulset $STATEFULSET_NAME --namespace=$NAMESPACE -o=jsonpath='{.status.availableReplicas}')

    if [[ $AVAILABLE_REPLICAS -ge 1 ]]; then
      break
    fi
    echo >&2 "Waiting for at least one buildkit replica to become available..."
    CURRENT_TIME=$(date +%s)
    ELAPSED_TIME=$((CURRENT_TIME - START_TIME))

    if [[ $ELAPSED_TIME -ge $TIMEOUT ]]; then
      echo >&2 "Timeout reached while waiting for statefulset to scale up."
      exit 1
    fi

    sleep 10
  done
  ;;

--attempt-scale-down)
  if [[ ! $2 =~ ^[0-9]+$ ]]; then
    echo >&2 "Please provide a valid numeric argument for --attempt-scale-down"
    exit 1
  fi

  THRESHOLD=$2
  CURRENT_TIME=$(date +%s)
  LAST_BUILD=$(kubectl get statefulset $STATEFULSET_NAME --namespace=$NAMESPACE -o=go-template="{{index .metadata.annotations \"$ANNOTATION_KEY\"}}" 2>/dev/null)
  echo >&2 "LAST_BUILD: $LAST_BUILD"

  if [[ -z $LAST_BUILD || $((CURRENT_TIME - LAST_BUILD)) -gt $THRESHOLD ]]; then
    echo >&2 "Last build occurred over $THRESHOLD seconds ago. Scaling down..."
    kubectl scale statefulset $STATEFULSET_NAME --namespace=$NAMESPACE --replicas=0
  else
    echo >&2 "Last build occurred less than $THRESHOLD seconds ago. Skipping scale down."
  fi
  ;;

*)
  echo >&2 "Usage: $0 [--record-build|--turn-on|--attempt-scale-down <seconds>]"
  exit 1
  ;;
esac
