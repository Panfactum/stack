#!/usr/bin/env bash
# Lists all MDX slide files for a given presentation slug, sorted by filename.

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: list-slides.sh <presentation-slug>" >&2
  exit 1
fi

SLUG="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRESENTATION_DIR="${SCRIPT_DIR}/../../../../packages/website/src/content/presentations/${SLUG}"

if [[ ! -d "$PRESENTATION_DIR" ]]; then
  echo "Error: Presentation '${SLUG}' not found at ${PRESENTATION_DIR}" >&2
  exit 1
fi

slide_num=1
for file in "$PRESENTATION_DIR"/*.mdx; do
  if [[ -f "$file" ]]; then
    echo "${slide_num}. $(basename "$file")"
    slide_num=$((slide_num + 1))
  fi
done
