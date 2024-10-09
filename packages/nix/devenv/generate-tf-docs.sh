#!/usr/bin/env bash

# Purpose: Uses terraform-docs to create the markdown documentation
# for each terraform module for the public website

OUTPUT_DIR="$DEVENV_ROOT/packages/website/src/app/docs/main/reference/infrastructure-modules"

# Initialize an empty JSON object with a `modules` array
JSON=$(jq -n '{modules: []}')

# Remove the old docs
rm -rf "$OUTPUT_DIR/aws"
rm -rf "$OUTPUT_DIR/kubernetes"
rm -rf "$OUTPUT_DIR/authentik"
rm -rf "$OUTPUT_DIR/vault"
rm -rf "$OUTPUT_DIR/utility"
rm -rf "$OUTPUT_DIR/direct"
rm -rf "$OUTPUT_DIR/submodule"

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
  sed -E 's@(helm|kubernetes|aws|time|local|vault|time|random|tls) \((.*)\)@[\1](https://registry.terraform.io/providers/hashicorp/\1/\2/docs) (\2)@g' |
    sed -E 's@kubectl \((.*)\)@[kubectl](https://registry.terraform.io/providers/alekc/kubectl/\1/docs) (\1)@g' |
    sed -E 's@authentik \((.*)\)@[authentik](https://registry.terraform.io/providers/goauthentik/authentik/\1/docs) (\1)@g'
}

function rename_provider_header() {
  sed -E 's@## Requirements@## Providers@g' |
    sed -E 's@The following requirements are needed by this module@The following providers are needed by this module@g' |
    sed -E 's@<a name="requirement_(.*)"></a>@@g'
}

function remove_version_header() {
  sed '/^Version:$/d'
}

function add_header() {
  sed -E "1iimport ModuleHeader from \"../../../ModuleHeader\";\n" |
    sed -E "6i<ModuleHeader name=\"$1\" sourceHref=\"https://github.com/Panfactum/stack/tree/__PANFACTUM_VERSION_MAIN__/packages/infrastructure/$1\" status=\"$2\" type=\"$3\"/>"
}

# Loop through each directory in the script's directory
for d in "$TERRAFORM_MODULES_DIR"/*; do
  if [ -d "$d" ]; then
    # Extract the name of the directory
    MODULE=$(basename "$d")

    # Ready the config
    TYPE=$(yq -r '.type' "$d/config.yaml")
    STATUS=$(yq -r '.status' "$d/config.yaml")
    GROUP=$(yq -r '.group' "$d/config.yaml")

    # Don't generate documentation for utility modules
    if [[ $TYPE == "utility" ]]; then
      continue
    fi

    # Append the directory name to the modules array in the JSON object
    JSON=$(jq --arg module "$MODULE" --arg group "$GROUP" --arg type "$TYPE" '.modules += [{"module": $module, "type": $type, "group": $group}]' <<<"$JSON")

    # Make the docs
    DOCS_DIR="$OUTPUT_DIR/$TYPE/$GROUP/$MODULE"
    mkdir -p "$DOCS_DIR"
    terraform-docs -c "$TERRAFORM_MODULES_DIR/.terraform-docs.yml" "$d" |
      add_provider_links |
      remove_version_header |
      rename_provider_header |
      add_header "$MODULE" "$STATUS" "$TYPE" |
      skip_injected_variables \
        >"$DOCS_DIR/page.mdx"
  fi
done

echo "$JSON" >"$OUTPUT_DIR/modules.json"
