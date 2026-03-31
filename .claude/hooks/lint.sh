#!/usr/bin/env bash
# PostToolUse hook: run linters on edited files.
# Dispatches linters based on file extension and path, running applicable tools in parallel.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ -z "$FILE_PATH" || ! -f "$FILE_PATH" ]]; then
  exit 0
fi

# Convert to relative path from project root for path-based matching
REL_PATH="${FILE_PATH#"$CLAUDE_PROJECT_DIR"/}"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

case "$FILE_PATH" in
*.md | *.mdx)
  { cspell lint --no-progress --gitignore "$FILE_PATH" >"$TMPDIR/cspell" 2>&1 || echo "cspell" >>"$TMPDIR/failed"; } &
  ;;
*.sh | *.bash)
  if [[ "$REL_PATH" =~ ^packages/(nix|installer|infrastructure)/ ]]; then
    { shellcheck "$FILE_PATH" >"$TMPDIR/shellcheck" 2>&1 || echo "shellcheck" >>"$TMPDIR/failed"; } &
  fi
  ;;
esac

wait

if [[ ! -f "$TMPDIR/failed" ]]; then
  exit 0
fi

ERRORS=""
while read -r tool; do
  case "$tool" in
  cspell)
    ERRORS+="cspell: spelling errors found in $FILE_PATH"$'\n'
    ERRORS+="$(cat "$TMPDIR/cspell")"$'\n'
    ;;
  shellcheck)
    ERRORS+="$(cat "$TMPDIR/shellcheck")"$'\n'
    ;;
  esac
done <"$TMPDIR/failed"

echo "$ERRORS" >&2
exit 2
