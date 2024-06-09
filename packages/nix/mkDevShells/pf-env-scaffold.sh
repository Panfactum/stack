#!/usr/bin/env bash

# This script scaffolds the environments directory and is intended to be used
# as a part of the bootstrapping guide to make setup easier.

set -eo pipefail

# Define the function to display the usage
usage() {
  echo "Usage: pf-env-scaffold -e <env1,env2,...>" >&2
  echo "       pf-env-scaffold --environments <env1,env2,...>" >&2
  echo "" >&2
  echo "<environments>: A comma-separated list of environments to setup" >&2
  exit 1
}

if [[ -z ${PF_ENVIRONMENTS_DIR} ]]; then
  echo "Error: PF_ENVIRONMENTS_DIR is not set. Add it to your devenv.nix file." >&2
  exit 1
fi

if [[ -z ${PF_AWS_DIR} ]]; then
  echo "Error: PF_AWS_DIR is not set. Add it to your devenv.nix file." >&2
  exit 1
fi

if [[ ! -f "$DEVENV_ROOT/$PF_AWS_DIR/config" ]]; then
  echo "Error: AWS CLI config file not found at $DEVENV_ROOT/$PF_AWS_DIR/config" >&2
  exit 1
fi

####################################################################
# Step 1: Argument parsing
####################################################################
ENVIRONMENTS=

# Parse arguments using getopt
PARSED_OPTIONS=$(getopt -n "$0" -o e: --long environments: -- "$@")
# shellcheck disable=SC2181
if [[ $? -ne 0 ]]; then
  echo "Failed parsing options." >&2
  usage
fi

eval set -- "$PARSED_OPTIONS"

# Process arguments
while true; do
  case "$1" in
  -e | --environments)
    IFS=',' read -r -a ENVIRONMENTS <<<"$2"
    shift 2
    ;;
  --)
    shift
    break
    ;;
  *)
    echo -e "Unknown argument provided\n" >&2
    usage
    ;;
  esac
done

# Check if environments are provided
# shellcheck disable=SC2128
if [ -z "${ENVIRONMENTS}" ]; then
  echo -e "--environments is required\n" >&2
  usage
fi

validate_environment_name() {
  if [[ ! $1 =~ ^[a-zA-Z0-9-]+$ ]]; then
    return 1
  else
    return 0
  fi
}

# Validate environment names
for ENV in "${ENVIRONMENTS[@]}"; do
  if ! validate_environment_name "$ENV"; then
    echo -e "Invalid environment name: $ENV. Only alphanumeric characters and hyphens are allowed." >&2
    exit 1
  fi
done

####################################################################
# Step 2: Select Regions
####################################################################

# List of all AWS regions
AWS_REGIONS=(
  "us-east-1 (N. Virginia)"
  "us-east-2 (Ohio)"
  "us-west-1 (N. California)"
  "us-west-2 (Oregon)"
  "af-south-1 (Cape Town)"
  "ap-east-1 (Hong Kong)"
  "ap-south-1 (Mumbai)"
  "ap-south-2 (Hyderabad)"
  "ap-southeast-1 (Singapore)"
  "ap-southeast-2 (Sydney)"
  "ap-southeast-3 (Jakarta)"
  "ap-southeast-4 (Melbourne)"
  "ap-northeast-1 (Tokyo)"
  "ap-northeast-2 (Seoul)"
  "ap-northeast-3 (Osaka)"
  "ca-central-1 (Canada)"
  "ca-west-1 (Calgary)"
  "eu-central-1 (Frankfurt)"
  "eu-central-2 (Zurich)"
  "eu-west-1 (Ireland)"
  "eu-west-2 (London)"
  "eu-west-3 (Paris)"
  "eu-south-1 (Milan)"
  "eu-south-2 (Spain)"
  "eu-north-1 (Stockholm)"
  "il-central-1 (Tel Aviv)"
  "me-south-1 (Bahrain)"
  "me-central-1 (UAE)"
  "sa-east-1 (São Paulo)"
  "us-gov-east-1"
  "us-gov-west-1"
)

# Allow user to select regions using fzf
SELECTED_AWS_REGIONS=$(printf "%s\n" "${AWS_REGIONS[@]}" | fzf --multi --prompt="Select AWS regions (at least 2): " | awk '{print $1}')

# Split selected regions into an array
readarray -t SELECTED_AWS_REGIONS <<<"$SELECTED_AWS_REGIONS"

# Check if at least 2 regions are selected
if [[ ${#SELECTED_AWS_REGIONS[@]} -lt 2 ]]; then
  echo -e "You must select at least 2 regions.\n" >&2
  exit 1
fi

####################################################################
# Step 3: Select Primary Region
####################################################################

PRIMARY_REGION=$(printf "%s\n" "${SELECTED_AWS_REGIONS[@]}" | fzf --prompt="Select the primary region (used for storing tf state): ")

####################################################################
# Step 4: Add implicit "global" region
####################################################################

SELECTED_AWS_REGIONS+=("global")

####################################################################
# Step 5: Collect per-environment params
####################################################################

# Function to get AWS account ID using AWS CLI and profile
get_aws_account_id() {
  aws sts get-caller-identity --profile "$1" --query "Account" --output text
}

# Arrays to store user inputs (parallel arrays to the environments array)
declare -A AWS_ACCOUNT_IDS
declare -A AWS_PROFILES

# Extracts the available AWS profiles from the config file
AVAILABLE_AWS_PROFILES=$(grep -oP '(?<=\[profile ).*?(?=\])' "$DEVENV_ROOT/$PF_AWS_DIR/config")

# Iterate over the environments and collect additional parameters
for ENV in "${ENVIRONMENTS[@]}"; do

  # Select the aws profile to use for the environment
  SELECTED_AWS_PROFILE=$(echo "$AVAILABLE_AWS_PROFILES" | fzf --prompt="Select AWS profile for environment $ENV: ")
  if [[ -n $SELECTED_AWS_PROFILE ]]; then
    AWS_PROFILES[$ENV]=$SELECTED_AWS_PROFILE
  else
    echo -e "No profile selected for $ENV. Exiting.\n" >&2
    exit 1
  fi

  # Extract the AWS account id based on the profile
  set +eo pipefail
  AWS_ACCOUNT_IDS[$ENV]=$(get_aws_account_id "$SELECTED_AWS_PROFILE")
  # shellcheck disable=SC2181
  if [[ $? -ne 0 ]]; then
    echo -e "Failed to get AWS account ID for profile $SELECTED_AWS_PROFILE. Exiting.\n" >&2
    exit 1
  fi
  set -eo pipefail
done

####################################################################
# Step 6: Find the stack version
####################################################################

# Search for the string and extract the capture group
FLAKE_FILE="$DEVENV_ROOT/flake.nix"
PF_VERSION=$(grep -oP 'panfactum/stack/\K([-\.0-9a-zA-Z]+)' "$FLAKE_FILE")

# Check if a capture group was found
if [[ -z $PF_VERSION ]]; then
  echo "Warning: No stack version found in $FLAKE_FILE. Using 'main'" >&2
  PF_VERSION=main
fi

####################################################################
# Step 7: Do the scaffolding
####################################################################

# Function to generate a random 8-character string
generate_random_string() {
  set +eo pipefail
  # shellcheck disable=SC2002
  cat /dev/urandom | tr -dc 'a-z0-9' 2>/dev/null | fold -w 8 | head -n 1
  set -eo pipefail
}

# Function to select a secondary region (just selects one randomly, but will be consistent across environments)
select_secondary_region() {
  local PRIMARY="$1"
  local SELECTED
  for REGION in "${SELECTED_AWS_REGIONS[@]}"; do
    if [[ $REGION != "$PRIMARY" ]] && [[ $REGION != "global" ]]; then
      SELECTED="$REGION"
      break
    fi
  done
  echo "$SELECTED"
}

GLOBAL_FILE="$DEVENV_ROOT/$PF_ENVIRONMENTS_DIR/global.yaml"
if [[ ! -f $GLOBAL_FILE ]]; then
  cat >"$DEVENV_ROOT/$PF_ENVIRONMENTS_DIR/global.yaml" <<EOF
# For reference, see https://panfactum.com/docs/edge/reference/configuration/terragrunt-variables
EOF
fi

for ENV in "${ENVIRONMENTS[@]}"; do

  # Create environment folder
  ENV_DIR="$DEVENV_ROOT/$PF_ENVIRONMENTS_DIR/$ENV"
  mkdir -p "$ENV_DIR"

  # Generate random string for tf_state_bucket
  SUFFIX=$(generate_random_string)

  # Create environment.yaml with specified content
  cat >"$ENV_DIR/environment.yaml" <<EOF
# For reference, see https://panfactum.com/docs/edge/reference/configuration/terragrunt-variables

# Meta
environment: "$ENV" # Name of the environment

# Versioning
pf_stack_version: "$PF_VERSION" # Version of the Panfactum Stack's IaC modules to use

# AWS
aws_account_id: "${AWS_ACCOUNT_IDS[$ENV]}" # ID of the aws account to use for the aws provider
aws_profile: "${AWS_PROFILES[$ENV]}" # Name of the AWS CLI profile to use for the aws provider
aws_secondary_account_id: "${AWS_ACCOUNT_IDS[$ENV]}" # ID of the aws account to use for the aws_secondary provider
aws_secondary_profile: "${AWS_PROFILES[$ENV]}" # Name of the AWS CLI profile to use for the aws_secondary provider

# State Bucket
tf_state_account_id: "${AWS_ACCOUNT_IDS[$ENV]}" # AWS Account for the S3 bucket holding the state file
tf_state_region: "${PRIMARY_REGION}" # Primary region for the S3 bucket holding the state file
tf_state_bucket: "tf-${ENV}-${SUFFIX}" # S3 bucket holding the state file
tf_state_lock_table: "tf-${ENV}-${SUFFIX}" # Dynamodb table holding state locks
tf_state_profile: "${AWS_PROFILES[$ENV]}" # AWS profile to assume for working with the state files
EOF

  for REGION in "${SELECTED_AWS_REGIONS[@]}"; do

    # Create region folder
    REGION_DIR="$ENV_DIR/$REGION"
    mkdir -p "$REGION_DIR"

    # Determine the AWS region and secondary region
    if [ "$REGION" == "global" ]; then
      AWS_REGION="$PRIMARY_REGION"
    else
      AWS_REGION="$REGION"
    fi
    AWS_SECONDARY_REGION=$(select_secondary_region "$AWS_REGION")

    cat >"$REGION_DIR/region.yaml" <<EOF
# For reference, see https://panfactum.com/docs/edge/reference/configuration/terragrunt-variables

# Meta
region: "$REGION" # The region's name

# AWS
aws_region: "$AWS_REGION" # The AWS region to use for the aws provider
aws_secondary_region: "$AWS_SECONDARY_REGION" # The secondary/backup region to use for the aws_secondary provider
EOF
  done
done

echo -e "Environment scaffolding complete. See configuration in $DEVENV_ROOT/$PF_ENVIRONMENTS_DIR.\n" >&2
