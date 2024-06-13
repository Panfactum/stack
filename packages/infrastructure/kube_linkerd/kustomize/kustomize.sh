#!/usr/bin/env bash

set -eo pipefail

SCRIPT=$(realpath "$0")
SCRIPTPATH=$(dirname "$SCRIPT")

# save manifests to files
echo "$1" >"$SCRIPTPATH/destination.yaml"
echo "$2" >"$SCRIPTPATH/identity.yaml"
echo "$3" >"$SCRIPTPATH/proxy-injector.yaml"

# save incoming YAML to file
cat <&0 >"$SCRIPTPATH/all.yaml"

# run kustomize
kustomize build "$SCRIPTPATH"

# rm all.yaml to prevent future hashes from breaking
rm -f "$SCRIPTPATH/all.yaml"
