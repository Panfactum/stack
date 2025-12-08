#!/usr/bin/env bash

# Purpose: Uses terraform-docs to create the markdown documentation
# for a single terraform module for the public website

set -e

if [ -z "$1" ]; then
  echo "Error: Module name is required" >&2
  echo "Usage: generate-tf-reference.sh <module_name>" >&2
  exit 1
fi

MODULE="$1"
DOCS_VERSION_DIR="$REPO_ROOT/packages/website/src/content/docs/main"
MODULES_DIR="$DOCS_VERSION_DIR/modules"
MODULE_SRC_DIR="$TERRAFORM_MODULES_DIR/$MODULE"

# Check if module directory exists
if [ ! -d "$MODULE_SRC_DIR" ]; then
  echo "Error: Module directory not found: $MODULE_SRC_DIR" >&2
  exit 1
fi

# Check if config.yaml exists
if [ ! -f "$MODULE_SRC_DIR/config.yaml" ]; then
  echo "Error: config.yaml not found in module directory: $MODULE_SRC_DIR" >&2
  exit 1
fi

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
  sed -E 's@- (helm|kubernetes|aws|time|local|vault|time|random|tls|archive) \((.*)\)@- [\1](https://registry.terraform.io/providers/hashicorp/\1/\2/docs) (\2)@g' |
    sed -E 's@- kubectl \((.*)\)@- [kubectl](https://registry.terraform.io/providers/alekc/kubectl/\1/docs) (\1)@g' |
    sed -E 's@- authentik \((.*)\)@- [authentik](https://registry.terraform.io/providers/goauthentik/authentik/\1/docs) (\1)@g' |
    sed -E 's@- pf \((.*)\)@- [pf](https://registry.terraform.io/providers/panfactum/pf/\1/docs) (\1)@g' |
    sed -E 's@- mongodbatlas \((.*)\)@- [mongodbatlas](https://registry.terraform.io/providers/panfactum/mongodbatlas/\1/docs) (\1)@g'
}

function rename_provider_header() {
  sed -E 's@## Requirements@## Providers@g' |
    sed -E 's@The following requirements are needed by this module@The following providers are needed by this module@g' |
    sed -E 's@<a name="requirement_(.*)"></a>@@g'
}

function remove_version_header() {
  sed '/^Version:$/d'
}

# Read the config
TYPE=$(yq -r '.type' "$MODULE_SRC_DIR/config.yaml")

# Don't generate documentation for utility modules
if [[ $TYPE == "utility" ]]; then
  echo "Skipping utility module: $MODULE"
  exit 0
fi

# Make the docs
MODULE_DIR="$MODULES_DIR/$MODULE"
mkdir -p "$MODULE_DIR"
terraform-docs -c "$TERRAFORM_MODULES_DIR/.terraform-docs.yml" "$MODULE_SRC_DIR" |
  add_provider_links |
  remove_version_header |
  rename_provider_header |
  skip_injected_variables \
    >"$MODULE_DIR/reference.mdx"

# Copy only image files from the doc_images directory if it exists
if [ -d "$MODULE_SRC_DIR/doc_images" ]; then
  mkdir -p "$MODULE_DIR/doc_images"
  find "$MODULE_SRC_DIR/doc_images" -maxdepth 1 -type f \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.gif" -o -iname "*.svg" -o -iname "*.webp" \) -exec cp {} "$MODULE_DIR/doc_images/" \;
fi

echo "Generated reference documentation for module: $MODULE"
