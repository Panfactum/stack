#!/usr/bin/env bash
# Stop hook: run prek on all changed files.

set -euo pipefail

cd "$CLAUDE_PROJECT_DIR"

# Collect all changed files (staged, unstaged, and untracked).
# --diff-filter=d excludes deletions so we don't pass non-existent paths to prek.
mapfile -t FILES < <(
  {
    NO_RTK=1 git diff --name-only --diff-filter=d HEAD 2>/dev/null || true
    NO_RTK=1 git ls-files --others --exclude-standard 2>/dev/null || true
  } | sort -u
)

if [[ ${#FILES[@]} -eq 0 ]]; then
  exit 0
fi

prek run --no-progress -c "$CLAUDE_PROJECT_DIR/.pre-commit-config.yaml" --files "${FILES[@]}" 1>&2 || exit 2
