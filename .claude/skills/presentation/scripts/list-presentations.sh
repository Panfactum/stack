#!/usr/bin/env bash
# Lists all presentation slugs under the presentations content directory.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRESENTATIONS_DIR="${SCRIPT_DIR}/../../../../packages/website/src/content/presentations"

if [[ ! -d "$PRESENTATIONS_DIR" ]]; then
  echo "Error: Presentations directory not found at ${PRESENTATIONS_DIR}" >&2
  exit 1
fi

for dir in "$PRESENTATIONS_DIR"/*/; do
  if [[ -d "$dir" ]]; then
    basename "$dir"
  fi
done
