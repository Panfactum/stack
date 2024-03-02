#!/usr/bin/env bash

set -eo pipefail

# Performs all of the linting for the monorepo

#######################################
## Terraform
#######################################
echo >&2 "Starting Terraform linting..."
(
  cd "$TERRAFORM_MODULES_DIR"
  terraform fmt -write=true -recursive
)
echo >&2 "Finished Terraform linting!"

#######################################
## Nix
#######################################
echo >&2 "Starting Nix linting..."
find "$DEVENV_ROOT" -type f -name '*.nix' -exec nixfmt {} \;
echo >&2 "Finished Nix linting!"

#######################################
## Shell
#######################################
echo >&2 "Starting shell linting..."
shfmt -w "$DEVENV_ROOT"
echo >&2 "Finished shell linting!"
