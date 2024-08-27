#!/usr/bin/env bash

# Returns repository variables as a JSON payload so that they can
# be referenced in other scripts
#
# It also performs the following mutations:
# - adds default values
# - resolves _dir variables to their absolute path on the local system
# - adds the repo_root variable
# - adds the iac_dir_from_root variable which is the original value of iac_dir before being resolved to an absolute path

set -eo pipefail

####################################################################
# Step 1: Get to the repository root (or root of devenv if using nested devenv)
####################################################################

ROOT="${1:-$(pwd)}"
ROOT=$(realpath "$ROOT")
while [[ ! -d "${ROOT}/.git" ]] && [[ ! -d "$ROOT/.devenv" ]]; do
  ROOT=$(dirname "$ROOT")
done

####################################################################
# Step 2: Read in the panfactum.yaml
####################################################################
CONFIG_FILE="$ROOT/panfactum.yaml"
if [[ -f $CONFIG_FILE ]]; then
  VALUES=$(yq -r . "$CONFIG_FILE")
else
  echo "Error: Repo configuration file does not exist at $CONFIG_FILE" >&2
  exit 1
fi

####################################################################
# Step 3: Validate required variables
####################################################################
if [[ $(echo "$VALUES" | jq -r '.repo_name') == "null" ]]; then
  echo "Error: repo_name must be set in $CONFIG_FILE" >&2
  exit 1
fi

if [[ $(echo "$VALUES" | jq -r '.repo_primary_branch') == "null" ]]; then
  echo "Error: repo_primary_branch must be set in $CONFIG_FILE" >&2
  exit 1
fi

REPO_URL=$(echo "$VALUES" | jq -r '.repo_url')

if [[ $REPO_URL == "null" ]]; then
  echo "Error: repo_url must be set in $CONFIG_FILE" >&2
  exit 1
fi

if [[ $REPO_URL == *"@"* ]]; then
  echo "Error: repo_url in $CONFIG_FILE must not contain a user prefix (e.g., git@)" >&2
  exit 1
fi

if [[ $REPO_URL == *"//"* ]]; then
  echo "Error: repo_url in $CONFIG_FILE must not contain a protocol prefix (e.g., http://)" >&2
  exit 1
fi

DIRS=("environments_dir" "iac_dir" "aws_dir" "kube_dir" "ssh_dir" "buildkit_dir")
for DIR in "${DIRS[@]}"; do
  DIR_VALUE=$(echo "$VALUES" | jq -r ".$DIR")
  if [[ $DIR_VALUE != "null" ]]; then
    if [[ $DIR_VALUE == /* ]]; then
      echo "Error: $DIR in $CONFIG_FILE must not contain a leading /" >&2
      exit 1
    elif [[ $DIR_VALUE == */ ]]; then
      echo "Error: $DIR in $CONFIG_FILE must not contain a trailing /" >&2
      exit 1
    fi
  fi
done

####################################################################
# Step 4: Set defaults
####################################################################
VALUES=$(echo "$VALUES" | jq --arg root "$ROOT" '.repo_root = $root | .environments_dir //= "environments" | .iac_dir //= "infrastructure" | .aws_dir //= ".aws" | .kube_dir //= ".kube" | .ssh_dir //= ".ssh" | .buildkit_dir //= ".buildkit"')

####################################################################
# Step 5: Resolve directories
####################################################################
VALUES=$(echo "$VALUES" | jq ".iac_dir_from_root = .iac_dir")
for DIR in "${DIRS[@]}"; do
  VALUES=$(echo "$VALUES" | jq ".$DIR = \"$(realpath "$ROOT/$(echo "$VALUES" | jq -r ".$DIR")")\"")
done

####################################################################
# Step 6: Print values
####################################################################

echo "$VALUES"
