#!/usr/bin/env bash

# Purpose: Uses terraform-docs to create the markdown documentation
# for each terraform module for the public website

OUTPUT_DIR="$DEVENV_ROOT/packages/website/src/app/(web)/docs/reference/terraform-modules"
TF_DIR="$DEVENV_ROOT/packages/terraform"

# Initialize an empty JSON object with a `modules` array
JSON=$(jq -n '{modules: []}')

# Remove the old docs
find "$OUTPUT_DIR" -type d | grep '_' | xargs rm -rf

# Loop through each directory in the script's directory
for d in "$TF_DIR"/*; do
  if [ -d "$d" ]; then
    # Extract the name of the directory
    MODULE=$(basename "$d")

    # Append the directory name to the modules array in the JSON object
    JSON=$(jq --arg module "$MODULE" '.modules += [$module]' <<<"$JSON")

    # Make the docs
    DOCS_DIR="$OUTPUT_DIR/$MODULE"
    mkdir -p "$DOCS_DIR"
    terraform-docs -c "$TF_DIR/.terraform-docs.yml" "$d" |
      sed -E 's@<a name="requirement_(.*)"></a>@@g' |
      sed -E 's@\[(helm|kubernetes|aws|time|local|vault|time|random)\]\(#requirement\\(.*)\) \((.*)\)@[\1](https://registry.terraform.io/providers/hashicorp/\1/\3/docs) (\3)@g' |
      sed -E 's@Source: ..\/([a-zA-Z_]*)@Source: [\1](./\1)@g' |
      sed '/^Version:$/d' |
      sed -E 's@## Requirements@## Providers@g' |
      sed -E 's@The following requirements are needed by this module@The following providers are needed by this module@g' |
      sed -E 's@\*\*Type:\*\* (.*)@**Type:** [\1](./overview)@g' \
        >"$DOCS_DIR/page.mdx"
  fi
done

echo "$JSON" >"$OUTPUT_DIR/modules.json"
