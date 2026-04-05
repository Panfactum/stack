#!/usr/bin/env bash
export NO_RTK=1

set -eo pipefail

# Ensures all @aws-sdk/client-* packages in packages/cli/package.json use the same exact version.
# Uses jq for reliable JSON parsing instead of grep/sed.

pkg="$REPO_ROOT/packages/cli/package.json"

versions=$(jq -r '.dependencies | to_entries[] | select(.key | startswith("@aws-sdk/client-")) | .value' "$pkg" | sort -u)
count=$(echo "$versions" | wc -l)

if [ "$count" -ne 1 ]; then
  echo "ERROR: @aws-sdk/client-* packages in packages/cli/package.json have inconsistent versions:"
  jq -r '.dependencies | to_entries[] | select(.key | startswith("@aws-sdk/client-")) | "  \(.key): \(.value)"' "$pkg"
  echo ""
  echo "All @aws-sdk/client-* packages must use the same exact version to avoid transitive dependency mismatches."
  exit 1
fi

# Ensure versions are pinned (no ^ or ~ prefix)
if echo "$versions" | grep -qE '[\^~]'; then
  echo "ERROR: @aws-sdk/client-* packages must use exact versions (no ^ or ~ prefix):"
  jq -r '.dependencies | to_entries[] | select(.key | startswith("@aws-sdk/client-")) | "  \(.key): \(.value)"' "$pkg"
  exit 1
fi
