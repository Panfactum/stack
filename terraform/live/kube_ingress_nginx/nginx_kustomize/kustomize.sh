#!/usr/bin/env bash

set -eo pipefail

SCRIPT=$(realpath "$0")
SCRIPTPATH=$(dirname "$SCRIPT")

# save incoming YAML to file
cat >"$SCRIPTPATH/all.yaml"

NAMESPACE=$1
DEPLOYMENT_NAME=$2
MIN_REPLICAS=$3
KUBE_CONTEXT=$4

##########################################################################
## Customization 1: Replica Count
##
## By default the helm chart scales the deployment down to 1 replica
## on updates. This can cause a service disruption.
##
## This patch ensures that the replica count does not change on updates
###########################################################################
set +e
current_replicas=$(kubectl -n "$NAMESPACE" --context="$KUBE_CONTEXT" get "deployment/$DEPLOYMENT_NAME" -o json 2>/dev/null | jq .spec.replicas)

# If the deployment doesn't exist yet, default the replica count to 2
# shellcheck disable=SC2181
if [[ $? != "0" ]]; then
  current_replicas=$MIN_REPLICAS
fi
set -e

cat <<EOF >"$SCRIPTPATH/patch.yaml"
apiVersion: v1
kind: Deployment
metadata:
  name: ingress-nginx-controller
spec:
  replicas: $current_replicas
EOF

######################################################################
# Run kustomize
#######################################################################
kustomize build "$SCRIPTPATH"

# rm all.yaml to prevent future hashes from breaking
rm -f "$SCRIPTPATH/all.yaml"
