#!/usr/bin/env bash

# Script is used to cut a new version of the docs

if [ -z "$1" ]; then
  echo "Usage: $0 new-version"
  exit 1
fi

script_dir=$(dirname "$0")

# Remove existing edge release
rm -rf "$script_dir/edge"

# Copy the directory
cp -r "$script_dir/main" "$script_dir/edge"

# Search and replace /docs/main with /docs/edge in all files
find "$script_dir/$1" -type f -exec sed -i -E "s|([\"'(])/docs/main|\1/docs/edge|g" {} \;

# Search and replace __PANFACTUM_VERSION_MAIN__ with __PANFACTUM_VERSION_EDGE__ in all files
find "$script_dir/$1" -type f -exec sed -i -E "s|__PANFACTUM_VERSION_MAIN__|__PANFACTUM_VERSION_EDGE__|g" {} \;
