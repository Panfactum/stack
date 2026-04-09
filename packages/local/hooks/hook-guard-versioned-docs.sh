#!@bash@
# PreToolUse hook: block edits to edge/ and stable-*/ docs unless
# CLAUDE_FULL_DOCS_ACCESS_ENABLED is set.
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | @jq@ -r '.tool_input.file_path // empty')

if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

REL_PATH="${FILE_PATH#"$CLAUDE_PROJECT_DIR"/}"
DOCS_PREFIX="packages/website/src/content/docs/"

case "$REL_PATH" in
"${DOCS_PREFIX}"edge/* | "${DOCS_PREFIX}"stable-*)
  if [[ -z "${CLAUDE_FULL_DOCS_ACCESS_ENABLED:-}" ]]; then
    echo "BLOCKED: edge/ and stable-*/ docs are auto-generated. Edit the source docs in main/ instead." >&2
    exit 2
  fi
  ;;
esac

exit 0
