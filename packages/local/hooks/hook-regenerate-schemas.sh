#!@bash@
# PostToolUse hook: regenerate changelog JSON schemas when metadata.yaml is edited.
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | @jq@ -r '.tool_input.file_path // empty')

if [[ -z "$FILE_PATH" || ! -f "$FILE_PATH" ]]; then
  exit 0
fi

REL_PATH="${FILE_PATH#"$CLAUDE_PROJECT_DIR"/}"

if [[ "$REL_PATH" != "packages/infrastructure/metadata.yaml" ]]; then
  exit 0
fi

@generateChangelogSchemas@ >/dev/null 2>&1

echo "Regenerated changelog JSON schemas after metadata.yaml change." >&2
exit 0
