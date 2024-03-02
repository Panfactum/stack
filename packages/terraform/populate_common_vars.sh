#!/usr/bin/env bash

# Purpose: All of our modules take a set of common input variables for consistent
# tagging. We define those inputs in a common file which is then copied to each
# module folder when we update it. This makes keeping those common variables consistent
# much easier.

# Iterate over each subdirectory in the search directory
for dir in "$TERRAFORM_MODULES_DIR"/*; do
  if [[ -d $dir && -f "$dir/main.tf" ]]; then
    # Copy common
    cp "$TERRAFORM_MODULES_DIR/common_vars.tf" "$dir"
    echo "Copied common_vars.tf to $dir" >&2
  fi
done
