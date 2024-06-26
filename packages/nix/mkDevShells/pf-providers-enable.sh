#!/usr/bin/env bash

# This script adds the necessary providers to the module.yaml based on the
# terragrunt module in the directory

set -eo pipefail

# Define the function to display the usage
usage() {
  echo "Usage: pf-providers-enable [--keep]" >&2
  echo "" >&2
  echo "--keep: Keeps the currently enabled providers and only adds new ones" >&2
  exit 1
}

if [[ $1 == "--keep" ]]; then
  KEEP=1
elif [[ -n $1 ]]; then
  usage
fi

####################################################################
# Step 1: Validate in a module directory
####################################################################

CWD=$(realpath "$(pwd)")

if ! [[ -f "$CWD/terragrunt.hcl" ]]; then
  echo "No terragrunt.hcl found in directory. This command must be run in a module folder." >&2
  exit 1
fi

####################################################################
# Step 2: Get the enabled providers
####################################################################

# This dynamically looks up all providers used in the module
# and adds their names to an array. This is helpful b/c this allows
# this script to be used even for providers not directly setup by Panfactum.
RAW_PROVIDERS=()
while IFS= read -r MATCH; do
  if [[ $MATCH =~ \[registry\.opentofu\.org/.+/(.+)\] ]]; then
    RAW_PROVIDERS+=("${BASH_REMATCH[1]}")
  fi
done <<<"$(terragrunt providers | grep -oP '\[registry\.opentofu\.org/.+?/(.+?)\]')"

# We don't want to add kubectl b/c we combine it with kubernetes
NEW_PROVIDERS=()
for EL in "${RAW_PROVIDERS[@]}"; do
  if [ "$EL" != "kubectl" ]; then
    NEW_PROVIDERS+=("$EL")
  else
    # If kubectl, add kubernetes instead in case for some reason the kubernetes provider isn't used
    NEW_PROVIDERS+=("kubernetes")
  fi
done

####################################################################
# Step 3: Add the providers to the module.yaml
####################################################################

# The yq command only works on a non-empty input file, so we need to ensure that exists
if ! [[ -f "$CWD/module.yaml" ]] || ! [[ -s "$CWD/module.yaml" ]]; then
  echo "providers: []" >"$CWD/module.yaml"
fi

NEW_PROVIDERS_YAML=$(printf '%s\n' "${NEW_PROVIDERS[@]}" | jq -R . | jq -s .)
if [[ $KEEP == 1 ]]; then
  yq -yi '(.providers //= []) | .providers += '"$NEW_PROVIDERS_YAML"' | .providers |= unique' "$CWD/module.yaml"
else
  yq -yi '.providers = '"$NEW_PROVIDERS_YAML"' | .providers |= unique' "$CWD/module.yaml"
fi

echo "Enabled providers:" >&2
yq -r '.providers[]' "$CWD/module.yaml" 1>&2
echo "" >&2

####################################################################
# Step 4: Add all platform checksums to .terraform.lock.hcl
####################################################################

echo "Updating .terraform.lock.hcl with provider checksums:" >&2
terragrunt providers lock \
  -platform=linux_amd64 \
  -platform=linux_arm64 \
  -platform=darwin_amd64 \
  -platform=darwin_arm64
