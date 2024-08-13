#!/usr/bin/env bash

# This script creates the necessary resources to begin using iac
# Should be run _after_ pf-env-scaffold

set -eo pipefail

# Define the function to display the usage
usage() {
  echo "Usage: pf-env-bootstrap" >&2
  echo "" >&2
  exit 1
}

REPO_VARIABLES=$(pf-get-repo-variables)
TG_VARIABLES=$(pf-get-terragrunt-variables)
AWS_PROFILE=$(echo "$TG_VARIABLES" | jq -r '.aws_profile')
REPO_ROOT=$(echo "$REPO_VARIABLES" | jq -r '.repo_root')
ENVIRONMENTS_DIR=$(echo "$REPO_VARIABLES" | jq -r '.environments_dir')

####################################################################
# Step 1: Extract the environment and perform some validation
####################################################################

CURRENT_DIR="$(realpath "$(pwd)")"

if ! [[ $CURRENT_DIR == "$ENVIRONMENTS_DIR"* ]]; then
  echo "Error: Script must run in an environment directory" >&2
  exit 1
fi

RELATIVE_PATH=$(realpath --relative-to="$ENVIRONMENTS_DIR" "$CURRENT_DIR")
ENVIRONMENT=$(echo "$RELATIVE_PATH" | cut -d'/' -f1)

if ! [[ -f "$ENVIRONMENTS_DIR/panfactum.hcl" ]]; then
  echo "Error: No panfactum.hcl found. Run 'pf-update-terragrunt' to generate." >&2
  exit 1
fi

GLOBAL_REGION_DIR="$ENVIRONMENTS_DIR/$ENVIRONMENT/global"
if ! [[ -d $GLOBAL_REGION_DIR ]]; then
  echo "Error: Global region not found in $ENVIRONMENT. Run 'pf-env-scaffold' to generate." >&2
  exit 1
fi

if [[ $AWS_PROFILE == "null" ]]; then
  echo "Error: No AWS profile set for environment. Run 'pf-env-scaffold' to create the necessary Terragrunt configuration files." >&2
  exit 1
fi

####################################################################
# Step 2: Confirmation
####################################################################

echo -e "You are about to bootstrap new environment: $ENVIRONMENT\n" >&2
echo -e "WARNING: This will create new resources and can possibly be destructive if run on an existing environment!\n" >&2
read -rp "Enter name of environment to confirm: " CONFIRM_ENVIRONMENT

if [[ $ENVIRONMENT != "$CONFIRM_ENVIRONMENT" ]]; then
  echo -e "\n$CONFIRM_ENVIRONMENT does not match $ENVIRONMENT. Exiting.\n" >&2
  exit 1
fi

####################################################################
# Step 3: Setup the tf_bootstrap_resources module
####################################################################

MODULE_DIR="$GLOBAL_REGION_DIR/tf_bootstrap_resources"

mkdir -p "$MODULE_DIR"
cat >"$MODULE_DIR/terragrunt.hcl" <<EOF
include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

inputs = {
  state_bucket = include.panfactum.locals.vars.tf_state_bucket
  lock_table   = include.panfactum.locals.vars.tf_state_lock_table
}
EOF

(
  cd "$MODULE_DIR"
  pf-providers-enable
)

####################################################################
# Step 4: Setup the tf_bootstrap_resources module
####################################################################

terragrunt init --terragrunt-non-interactive --terragrunt-working-dir "$MODULE_DIR"

####################################################################
# Step 5: Import the resources
####################################################################

terragrunt render-json --terragrunt-working-dir "$MODULE_DIR"

STATE_BUCKET=$(jq -r '.inputs.state_bucket' "$MODULE_DIR/terragrunt_rendered.json")
LOCK_TABLE=$(jq -r '.inputs.lock_table' "$MODULE_DIR/terragrunt_rendered.json")

rm -f "$MODULE_DIR/terragrunt_rendered.json"

terragrunt import aws_s3_bucket.state "$STATE_BUCKET" --terragrunt-working-dir "$MODULE_DIR"
terragrunt import aws_dynamodb_table.lock "$LOCK_TABLE" --terragrunt-working-dir "$MODULE_DIR"

####################################################################
# Step 6: Apply the module
####################################################################

terragrunt apply --auto-approve --terragrunt-non-interactive --terragrunt-working-dir "$MODULE_DIR"

####################################################################
# Step 7: Setup the sops module
####################################################################

MODULE_DIR="$GLOBAL_REGION_DIR/sops"

mkdir -p "$MODULE_DIR"
cat >"$MODULE_DIR/terragrunt.hcl" <<EOF
include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

inputs = {
  name        = "sops-\${include.panfactum.locals.vars.environment}"
  description = "Encryption key for sops"
}
EOF

(
  cd "$MODULE_DIR"
  pf-providers-enable
)

echo "module: aws_kms_encrypt_key" >>"$MODULE_DIR/module.yaml"

####################################################################
# Step 8: Apply the sops module
####################################################################

terragrunt apply --auto-approve --terragrunt-non-interactive --terragrunt-working-dir "$MODULE_DIR"

####################################################################
# Step 9: Setups sops.yaml
####################################################################

MODULE_OUTPUT=$(terragrunt output --json --terragrunt-non-interactive --terragrunt-working-dir "$MODULE_DIR")
ARN="$(echo "$MODULE_OUTPUT" | jq -r '.arn.value')"
ARN2="$(echo "$MODULE_OUTPUT" | jq -r '.arn2.value')"

SOPS_CONFIG="$REPO_ROOT/.sops.yaml"

if ! [[ -f $SOPS_CONFIG ]]; then
  cat >"$SOPS_CONFIG" <<EOF
creation_rules:
EOF
fi

yq -Y -i '.creation_rules += [{"path_regex": ".*/'"$ENVIRONMENT"'/.*", "aws_profile": "'"$AWS_PROFILE"'", "kms": "'"$ARN"','"$ARN2"'"}]' "$SOPS_CONFIG"
