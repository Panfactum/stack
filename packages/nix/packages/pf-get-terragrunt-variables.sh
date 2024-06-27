#!/usr/bin/env bash

set -eo pipefail

usage() {
  echo "Prints a JSON object containing the Terragrunt variables that Terragrunt would use if it were run in the given directory." >&2
  echo "Terragrunt variables are the Panfactum-specific configuration settings defined here:" >&2
  echo "https://panfactum.com/docs/edge/reference/configuration/terragrunt-variables." >&2
  echo "" >&2
  echo "Usage: pf-get-terragrunt-variables [directory]" >&2
  echo "" >&2
  echo "[directory]:    (Optional): Resolves the variables used by Terragrunt if Terragrunt were run in this directory. Defaults to the current directory." >&2
  exit 1
}

if [[ $1 == "-h" || $1 == "--help" ]]; then
  usage
fi

declare -a FILES
DIRECTORY="${1:-$(pwd)}"
DIRECTORY=$(realpath "$DIRECTORY")
while [[ ! -d "${DIRECTORY}/.git" ]] && [[ $DIRECTORY != "/" ]]; do
  # User files take precedence
  for FILE in "$DIRECTORY"/{module.user.yaml,region.user.yaml,environment.user.yaml,global.user.yaml}; do
    if [[ -f $FILE ]]; then
      FILES+=("$FILE")
    fi
  done
  for FILE in "$DIRECTORY"/{module.yaml,region.yaml,environment.yaml,global.yaml}; do
    if [[ -f $FILE ]]; then
      FILES+=("$FILE")
    fi
  done
  DIRECTORY=$(dirname "$DIRECTORY")
done

# If YAML files are found, merge and convert to JSON
if [[ ${#FILES[@]} -gt 0 ]]; then
  # Initialize the merged content
  MERGED="{}"

  # Perform shallow merge using yq
  for FILE in "${FILES[@]}"; do
    # The merge order here is important b/c files earlier in the array should take precedence
    MERGED=$(echo "$MERGED" | yq -ys '.[1] * .[0]' - "$FILE")
  done

  # Convert merged YAML to JSON and output
  echo "$MERGED" | yq -r .
else
  echo "Warning: No configuration files found." >&2
  echo "{}"
fi
