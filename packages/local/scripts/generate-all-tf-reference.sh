#!/usr/bin/env bash

# Purpose: Generates terraform-docs reference documentation for all modules

set -e

echo "Generating reference documentation for all terraform modules..."

# Loop through each directory in the terraform modules directory
for d in "$TERRAFORM_MODULES_DIR"/*; do
  if [ -d "$d" ]; then
    # Extract the name of the directory
    MODULE=$(basename "$d")

    # Generate docs for this module
    generate-tf-reference "$MODULE"
  fi
done

echo "Finished generating all module reference documentation"
