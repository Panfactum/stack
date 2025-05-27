#!/usr/bin/env bash

set -eo pipefail

# This script is intended to support
# local development by invalidating the terraform module cache whenever
# the code in any of our Panfactum modules changes

module_folder=$1

if [[ -z $module_folder ]]; then
  echo ""
else
  find "$(realpath "$module_folder")" -type f -print0 | sort -z | xargs -0 sha1sum | sha1sum | cut -d' ' -f1
fi
