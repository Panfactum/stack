#!/usr/bin/env bash
# Claude Code hook script for automatically running ESLint on CLI TypeScript files
# Processes JSON input from stdin and conditionally runs bun eslint --fix on matching files

set -euo pipefail

# Read JSON input from stdin
json_input=$(cat)

# Parse JSON and extract required fields, exit with code 1 if malformed
tool_name=$(echo "$json_input" | jq -r '.tool_name' 2>/dev/null)
if [[ "$tool_name" == "null" || -z "$tool_name" ]]; then
  echo "Error: Missing or invalid tool_name in JSON input" >&2
  exit 1
fi

file_path=$(echo "$json_input" | jq -r '.tool_input.file_path' 2>/dev/null)
if [[ "$file_path" == "null" || -z "$file_path" ]]; then
  echo "Error: Missing or invalid tool_input.file_path in JSON input" >&2
  exit 1
fi

# Check if tool_name is "Write" or "Edit"
if [[ "$tool_name" != "Write" && "$tool_name" != "Edit" ]]; then
  exit 0
fi

# Check if file_path matches the regex pattern .*\/stack/cli\/.*\.ts
if [[ ! "$file_path" =~ .*\/stack/packages/cli\/.*\.ts$ ]]; then
  exit 0
fi

# Change to the CLI package directory and run ESLint
cd "$REPO_ROOT/packages/cli"

# Run bun eslinton the target file
if bun eslint "$file_path" >&2; then
  # ESLint succeeded
  exit 0
else
  # ESLint found errors
  exit 2
fi
