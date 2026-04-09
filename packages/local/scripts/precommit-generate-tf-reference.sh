#!/usr/bin/env bash

# Purpose: Pre-commit hook wrapper that generates terraform reference docs
# for modules that have changed files

set -e

# Extract unique module names from the file paths
modules=()
for file in "$@"; do
  # Check if the file is in a module directory
  if [[ $file =~ ^packages/infrastructure/([^/]+)/ ]]; then
    module="${BASH_REMATCH[1]}"
    # Add to array if not already present
    found=false
    for existing_module in "${modules[@]}"; do
      if [[ "$existing_module" == "$module" ]]; then
        found=true
        break
      fi
    done
    if [[ "$found" == "false" ]]; then
      modules+=("$module")
    fi
  fi
done

# Generate docs for each affected module
for module in "${modules[@]}"; do
  echo "Generating reference docs for changed module: $module"
  generate-tf-reference "$module"
done

exit 0
