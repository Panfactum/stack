#!/usr/bin/env bash

# Script is used to cut a new version of the docs

if [ -z "$1" ]; then
  echo "Usage: $0 new-version"
  exit 1
fi

script_dir=$(dirname "$0")

# Copy the directory
cp -r "$script_dir/edge" "$script_dir/$1"

# Search and replace /docs/edge with /docs/$1 in all files
find "$script_dir/$1" -type f -exec sed -i -E "s|([\"'(])/docs/edge|\1/docs/$1|g" {} \;

# Search and replace __PANFACTUM_VERSION_EDGE__ with __PANFACTUM_VERSION_$1__ in all files
find "$script_dir/$1" -type f -exec sed -i -E "s|__PANFACTUM_VERSION_EDGE__|__PANFACTUM_VERSION_$(echo "$1" | tr "-" "_")__|g" {} \;
