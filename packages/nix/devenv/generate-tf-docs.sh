#!/usr/bin/env bash

# Purpose: Uses terraform-docs to create the markdown documentation
# for each terraform module for the public website

OUTPUT_DIR="$DEVENV_ROOT/packages/website/src/app/docs/reference/infrastructure-modules"

# Initialize an empty JSON object with a `modules` array
JSON=$(jq -n '{modules: []}')

# Remove the old docs
find "$OUTPUT_DIR" -type d | grep '_' | xargs rm -rf

function skip_injected_variables() {
  awk '
  {
    lines[NR] = $0
  }
  /#injected/ {
    for (i = NR-2; i <= NR; i++)
      delete lines[i]
    for (i = NR; i <= NR+4; i++)
      toSkip[i] = 1
  }
  END {
    for (i = 1; i <= NR; i++)
      if (i in lines && !(i in toSkip))
        print lines[i]
  }
  '
}

function add_provider_links() {
  sed -E 's@\[(helm|kubernetes|aws|time|local|vault|time|random)\]\(#requirement\\(.*)\) \((.*)\)@[\1](https://registry.terraform.io/providers/hashicorp/\1/\3/docs) (\3)@g'
}

function rename_provider_header() {
  sed -E 's@## Requirements@## Providers@g' |
    sed -E 's@The following requirements are needed by this module@The following providers are needed by this module@g' |
    sed -E 's@<a name="requirement_(.*)"></a>@@g'
}

function remove_version_header() {
  sed '/^Version:$/d'
}

function add_type_link() {
  sed -E 's@\*\*Type:\*\* (.*)@**Type:** [\1](/docs/reference/infrastructure-modules/overview)@g'
}

function add_module_source_link() {
  sed "5i**Source Code:** [Link](https://github.com/Panfactum/stack/tree/__currentPanfactumVersion__/packages/infrastructure/$1)\n"
}

# Loop through each directory in the script's directory
for d in "$TERRAFORM_MODULES_DIR"/*; do
  if [ -d "$d" ]; then
    # Extract the name of the directory
    MODULE=$(basename "$d")

    # Append the directory name to the modules array in the JSON object
    JSON=$(jq --arg module "$MODULE" '.modules += [$module]' <<<"$JSON")

    # Make the docs
    DOCS_DIR="$OUTPUT_DIR/$MODULE"
    mkdir -p "$DOCS_DIR"
    terraform-docs -c "$TERRAFORM_MODULES_DIR/.terraform-docs.yml" "$d" |
      add_module_source_link "$MODULE" |
      add_provider_links |
      remove_version_header |
      rename_provider_header |
      add_type_link |
      skip_injected_variables \
        >"$DOCS_DIR/page.mdx"
  fi
done

echo "$JSON" >"$OUTPUT_DIR/modules.json"
