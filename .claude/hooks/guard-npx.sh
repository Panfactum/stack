#!/usr/bin/env bash
# PreToolUse hook: block npx/node commands and instruct to use bun instead.
export NO_RTK=1

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if echo "$COMMAND" | grep -qE '\b(npx|node)\b'; then
  echo "BLOCKED: Do not use npx or node. Use bun instead." >&2
  exit 2
fi

exit 0
