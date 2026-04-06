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

# prek exits non-zero whenever a hook autofixes a file, even when there is
# no real error. To distinguish autofix from a true failure, snapshot the
# file contents before the run. If prek fails but the files are unchanged,
# it's a real error - bail immediately. If files were modified, re-run to
# confirm whether the autofix resolved everything.
hash_files() {
  sha256sum -- "${FILES[@]}" 2>/dev/null | sha256sum
}

before=$(hash_files)
if ! prek run --no-progress -c "$CLAUDE_PROJECT_DIR/.pre-commit-config.yaml" --files "${FILES[@]}" 1>&2; then
  after=$(hash_files)
  if [[ "$before" == "$after" ]]; then
    exit 2
  fi
  prek run --no-progress -c "$CLAUDE_PROJECT_DIR/.pre-commit-config.yaml" --files "${FILES[@]}" 1>&2 || exit 2
fi
