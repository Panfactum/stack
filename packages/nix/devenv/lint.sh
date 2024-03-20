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

#######################################
## Documentation
#######################################
echo >&2 "Starting documentation linting..."
(
  cd "$DEVENV_ROOT/packages/website"
  ./node_modules/.bin/remark src -e .mdx -e .md -o -S
)
echo >&2 "Finished documentation linting!"

#######################################
## Spell Check
#######################################
echo >&2 "Starting spellcheck linting..."
(
  cd "$DEVENV_ROOT"
  cspell lint --no-cache --no-progress '**/*.mdx' '**/*.md'
)
echo >&2 "Finished spellcheck linting!"

#######################################
## Website
#######################################
echo >&2 "Starting website linting..."
(
  cd "$DEVENV_ROOT/packages/website"
  ./node_modules/.bin/eslint --fix src
)
echo >&2 "Finished website linting!"
