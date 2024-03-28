#!/usr/bin/env bash

set -eo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
set +o pipefail
TAG=${1:-"local-$(tr -dc 'a-z0-9' </dev/urandom | head -c 8)"}
set -o pipefail
TARGET=${2:-production}

"$SCRIPT_DIR/build-image.sh" "$TAG" "$TARGET"
"$SCRIPT_DIR/push-image.sh" "$TAG"
