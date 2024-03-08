#!/usr/bin/env bash

set -eo pipefail

generate-tf-docs

git add "$DEVENV_ROOT/packages/website/src/app/(web)/docs/reference/terraform-modules"
