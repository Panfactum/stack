#!/usr/bin/env bash

# Purpose: All of our modules take a set of common input variables for consistent
# tagging. We define those inputs in a common file which is then copied to each
# module folder when we update it. This makes keeping those common variables consistent
# much easier.

# New content to replace between the markers
COMMON_VARS_SNIPPET=$(cat "$TERRAFORM_MODULES_DIR/common_vars.snippet.txt")
COMMON_VARS_NO_EXTRA_TAGS_SNIPPET=$(cat "$TERRAFORM_MODULES_DIR/common_vars_no_extra_tags.snippet.txt")
COMMON_VARS_NO_REGION_SNIPPET=$(cat "$TERRAFORM_MODULES_DIR/common_vars_no_region.snippet.txt")
PASS_COMMON_VARS_SNIPPET=$(cat "$TERRAFORM_MODULES_DIR/pass_common_vars.snippet.txt")
PASS_COMMON_VARS_NO_EXTRA_TAGS_SNIPPET=$(cat "$TERRAFORM_MODULES_DIR/pass_common_vars_no_extra_tags.snippet.txt")

END_MARKER="^[[:space:]]*#[[:space:]]*end-generate"

function replace_snippet() {
  awk -v start="$1" -v end="$END_MARKER" -v replacement="$2" '
    $0 ~ start {print; p=1; print replacement; next}
    $0 ~ end {p=0}
    !p
  ' "$3" >/tmp/temp.tf && mv /tmp/temp.tf "$3"
}

for MODULE_DIR in "$TERRAFORM_MODULES_DIR"/*; do
  if [[ -d $MODULE_DIR ]]; then

    MODULE_NAME="$(basename "$MODULE_DIR")"

    cp "$TERRAFORM_MODULES_DIR/common_vars.tf" "$MODULE_DIR"

    # Path to your Terraform file
    FILE_PATH="$MODULE_DIR/main.tf"

    # Apply snippets
    replace_snippet "^[[:space:]]*#[[:space:]]*generate:[[:space:]]*common_vars.snippet.txt" "$COMMON_VARS_SNIPPET" "$FILE_PATH"
    replace_snippet "^[[:space:]]*#[[:space:]]*generate:[[:space:]]*common_vars_no_extra_tags.snippet.txt" "$COMMON_VARS_NO_EXTRA_TAGS_SNIPPET" "$FILE_PATH"
    replace_snippet "^[[:space:]]*#[[:space:]]*generate:[[:space:]]*common_vars_no_region.snippet.txt" "$COMMON_VARS_NO_REGION_SNIPPET" "$FILE_PATH"
    replace_snippet "^[[:space:]]*#[[:space:]]*generate:[[:space:]]*pass_common_vars.snippet.txt" "$PASS_COMMON_VARS_SNIPPET" "$FILE_PATH"
    replace_snippet "^[[:space:]]*#[[:space:]]*generate:[[:space:]]*pass_common_vars_no_extra_tags.snippet.txt" "$PASS_COMMON_VARS_NO_EXTRA_TAGS_SNIPPET" "$FILE_PATH"

    # Set the default module names
    sed -i "s/__module_name__/${MODULE_NAME}/g" "$MODULE_DIR/common_vars.tf"
  fi
done
