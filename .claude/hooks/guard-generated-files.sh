#!/usr/bin/env bash
# PreToolUse hook: block direct edits to generated files and point to their sources.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

REL_PATH="${FILE_PATH#"$CLAUDE_PROJECT_DIR"/}"

case "$REL_PATH" in
packages/website/src/content/changelog/log.schema.json)
  echo "BLOCKED: log.schema.json is auto-generated. Edit packages/nix/localDevShell/scripts/ds-generate-changelog-schemas.ts instead, then run ds-generate-changelog-schemas to regenerate." >&2
  exit 2
  ;;
esac

exit 0
