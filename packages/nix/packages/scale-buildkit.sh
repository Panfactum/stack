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


*)
  echo >&2 "Usage: $0 [--record-build|--turn-on|--attempt-scale-down <seconds>]"
  exit 1
  ;;
esac
