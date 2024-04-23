#!/usr/bin/env bash

# Purpose: All of our modules take a set of common input variables for consistent
# tagging. We define those inputs in a common file which is then copied to each
# module folder when we update it. This makes keeping those common variables consistent
# much easier.

# Iterate over each subdirectory in the search directory
for MODULE_DIR in "$TERRAFORM_MODULES_DIR"/*; do
  if [[ -d $MODULE_DIR ]]; then

    MODULE_NAME="$(basename "$MODULE_DIR")"

    # Copy common
    cp "$TERRAFORM_MODULES_DIR/common_vars.tf" "$MODULE_DIR"

    # Set the default module names
    sed -i "s/__module_name__/${MODULE_NAME}/g" "$MODULE_DIR/common_vars.tf"

    echo "Copied common_vars.tf to $MODULE_NAME" >&2
  fi
done
