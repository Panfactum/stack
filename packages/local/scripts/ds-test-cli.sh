#!/usr/bin/env bash
set -eo pipefail
(
  cd "$REPO_ROOT/packages/cli"
  declare -A seen
  test_files=()
  for file in "$@"; do
    # Strip the leading packages/cli/ prefix (files are repo-root-relative)
    rel="${file#packages/cli/}"
    # If it's already a test file, use it directly; otherwise derive it
    if [[ "$rel" == *.test.ts ]]; then
      candidate="$rel"
    else
      candidate="${rel%.ts}.test.ts"
    fi
    # Only include the candidate if it exists and hasn't been added yet
    if [[ -f "$candidate" && -z "${seen[$candidate]+x}" ]]; then
      seen["$candidate"]=1
      test_files+=("$candidate")
    fi
  done
  if [[ ${#test_files[@]} -eq 0 ]]; then
    exit 0
  fi
  bun test "${test_files[@]}"
)