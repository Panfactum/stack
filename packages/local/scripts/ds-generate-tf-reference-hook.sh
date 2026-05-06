#!/usr/bin/env bash
set -e
modules=()
for file in "$@"; do
  if [[ $file =~ ^packages/infrastructure/([^/]+)/ ]]; then
    module="${BASH_REMATCH[1]}"
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
for module in "${modules[@]}"; do
  echo "Generating reference docs for changed module: $module"
  ds-generate-tf-reference "$module"
done
exit 0