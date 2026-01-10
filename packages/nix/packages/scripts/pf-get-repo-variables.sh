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
# Step 1: Get to the repository root (or root of panfactum.yaml if using reference env)
####################################################################

ROOT="${1:-$(pwd)}"
ROOT=$(realpath "$ROOT")
while [[ ! -e "${ROOT}/.git" ]] && [[ ! -f "$ROOT/panfactum.yaml" ]]; do
  if [[ "$ROOT" == "/" ]]; then
    echo "Error: Could not find .git or panfactum.yaml in any parent directory" >&2
    exit 1
  fi
  ROOT=$(dirname "$ROOT")
done

GIT_ROOT="${1:-$(pwd)}"
GIT_ROOT=$(realpath "$GIT_ROOT")
while [[ ! -e "${GIT_ROOT}/.git" ]]; do
  if [[ "$GIT_ROOT" == "/" ]]; then
    echo "Error: Could not find .git in any parent directory" >&2
    exit 1
  fi
  GIT_ROOT=$(dirname "$GIT_ROOT")
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

if ! [[ $REPO_URL == git::https://* || $REPO_URL == github.com* || $REPO_URL == bitbucket.org* ]]; then
  echo "Error: repo_url in $CONFIG_FILE must be a valid TF module source that uses HTTPS. See https://opentofu.org/docs/language/modules/sources." >&2
  exit 1
fi

DIRS=("environments_dir" "iac_dir" "aws_dir" "kube_dir" "ssh_dir" "buildkit_dir" "nats_dir")
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
VALUES=$(echo "$VALUES" | jq --arg root "$ROOT" '.repo_root = $root | .environments_dir //= "environments" | .iac_dir //= "infrastructure" | .aws_dir //= ".aws" | .kube_dir //= ".kube" | .ssh_dir //= ".ssh" | .buildkit_dir //= ".buildkit" | .nats_dir //= ".nats"')

####################################################################
# Step 5: Resolve directories
####################################################################
VALUES=$(echo "$VALUES" | jq ".iac_dir_from_root = .iac_dir")
for DIR in "${DIRS[@]}"; do
  VALUES=$(echo "$VALUES" | jq ".$DIR = \"$(realpath "$ROOT/$(echo "$VALUES" | jq -r ".$DIR")")\"")
done

####################################################################
# Step 6: Set iac_dir_from_git_root
#
# This is a bit of a hack to account for the case where the repo_root
# is different from the git root dir which can occur in cases
# like the reference system which is a subdirectory of a git repository
####################################################################
IAC_DIR_FROM_GIT_ROOT="$(echo "$(echo "$VALUES" | jq -r ".repo_root" | sed -e "s|^$GIT_ROOT||")/$(echo "$VALUES" | jq -r ".iac_dir_from_root")" | sed -e "s|^/||")"
VALUES=$(echo "$VALUES" | jq ".iac_dir_from_git_root = \"$IAC_DIR_FROM_GIT_ROOT\"")

####################################################################
# Step 7: Print values
####################################################################

echo "$VALUES"
