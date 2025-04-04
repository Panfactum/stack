#!/usr/bin/env bash

set -eo pipefail

# Performs all of the linting for the monorepo

# Needed to avoid running out of memory
export NODE_OPTIONS="--max-old-space-size=8192"

export LINT="true"

#######################################
## Install node modules
#######################################
(
  cd "$REPO_ROOT"
  pnpm i
)

#######################################
## Terraform
#######################################
echo >&2 "Starting Terraform linting..."
(
  cd "$TERRAFORM_MODULES_DIR"
  tofu fmt -write=true -recursive
)
echo >&2 "Finished Terraform linting!"

#######################################
## Terragrunt
#######################################
echo >&2 "Starting Terragrunt linting..."
(
  cd "$REPO_ROOT/packages/nix/packages/scripts/files/terragrunt"
  terragrunt hclfmt
)
echo >&2 "Finished Terragrunt linting!"

#######################################
## Nix
#######################################
echo >&2 "Starting Nix linting..."
find "$REPO_ROOT" -type f -name '*.nix' -exec nixfmt {} \;
echo >&2 "Finished Nix linting!"

#######################################
## Shell
#######################################
echo >&2 "Starting shell linting..."
shfmt -w "$REPO_ROOT/packages/nix"
shfmt -w "$REPO_ROOT/packages/infrastructure"
echo >&2 "Finished shell linting!"

#######################################
## Spell Check
#######################################
echo >&2 "Starting spellcheck linting..."
lint-spellcheck
echo >&2 "Finished spellcheck linting!"

#######################################
## Website
#######################################
echo >&2 "Starting website linting..."
(
  lint-website
)
echo >&2 "Finished website linting!"
