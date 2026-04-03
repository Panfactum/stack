#!/usr/bin/env bash
# PreToolUse hook: block direct `git show` and `git diff` commands.
# Diffs should come from changelog scripts (show-diff.ts), not raw git commands.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if echo "$COMMAND" | grep -qE '\bgit\s+(show|diff)\b'; then
  echo "BLOCKED: Do not run git show/diff directly. Use the show-diff.ts script instead." >&2
  exit 2
fi

exit 0
