#!/usr/bin/env bash

set -eo pipefail

#####################################################
# Step 1: Setup AWS profile
#####################################################
export AWS_CONFIG_FILE="/.aws/config"
cat >"$AWS_CONFIG_FILE" <<EOF
[profile ci]
role_arn = $AWS_ROLE_ARN
web_identity_token_file = /var/run/secrets/eks.amazonaws.com/serviceaccount/token
role_session_name = ci-runner
EOF

#####################################################
# Step 2: Get the Who of the locks
#####################################################
# Set the host name as that gets set as the tf lock holder
# that we will use in the emergency unlock logic
WHO=$(md5sum <<< "$PF_REPO_URL$TF_APPLY_DIR" | cut -f 1 -d' ')

#####################################################
# Step 3: Unlock
#####################################################
pf-tf-delete-locks \
  --profile ci \
  --region "$TF_LOCK_TABLE_REGION" \
  --table "$TF_LOCK_TABLE" \
  --who "$WHO"