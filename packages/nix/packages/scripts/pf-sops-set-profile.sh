#!/usr/bin/env bash

set -eo pipefail

####################################################################
# Step 1: Variable parsing
####################################################################
DIRECTORY=
AWS_PROFILE=

usage() {
  echo "Updates the AWS profile used to access KMS in all sops-encrypted YAML files in the indicated directory tree." >&2
  echo "This can be used in CI pipelines to simplify access to encrypted files that would otherwise require many" >&2
  echo "AWS profiles to be configured." >&2
  echo "" >&2
  echo "Usage: pf-sops-set-profile -d <directory> -p <aws-profile>" >&2
  echo "       pf-sops-set-profile --directory <directory> --profile <aws-profile>" >&2
  echo "" >&2
  echo "<directory>:    All sops-encrypted files in this directory tree will be updated" >&2
  echo "<aws-profile>:  The AWS profile to use for accessing KMS for each sops-encrypted file" >&2
  exit 1
}

# Parse command line arguments
TEMP=$(getopt -o d:p: --long profile:,directory:, -- "$@")

# shellcheck disable=SC2181
if [[ $? != 0 ]]; then
  echo "Failed parsing options." >&2
  exit 1
fi

# Note the quotes around `$TEMP`: they are essential!
eval set -- "$TEMP"

# Extract options and their arguments into variables
while true; do
  case "$1" in
  -d | --directory)
    DIRECTORY="$2"
    shift 2
    ;;
  -p | --profile)
    AWS_PROFILE="$2"
    shift 2
    ;;
  --)
    shift
    break
    ;;
  *)
    echo "Unknown argument provided: $1" >&2
    usage
    ;;
  esac
done

if [[ -z $DIRECTORY ]]; then
  echo "--directory is a required argument." >&2
  exit 1
fi

if [[ -z $AWS_PROFILE ]]; then
  echo "--profile is a required argument." >&2
  exit 1
fi

####################################################################
# Step 2: Update the sops-encrypted files
####################################################################

function update_sops_file() {
  local FILE="$1"
  if yq -e '.sops.kms' "$FILE" >/dev/null 2>&1; then
    echo "Updating sops-encrypted file: $FILE" >&2
    yq -Yi '(.sops.kms[] | select(has("aws_profile"))).aws_profile = "'"$AWS_PROFILE"'"' "$FILE"
  fi
}

find "$DIRECTORY" -type f -name "*.yaml" | while read -r FILE; do
  update_sops_file "$FILE"
done
