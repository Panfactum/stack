#!/usr/bin/env bash

set -eo pipefail

#####################################################
# Step 1: Checkout the repo
#####################################################
cd /code
pf-wf-git-checkout \
  -r "$REPO" \
  -c "$GIT_REF" \
  -u "$GIT_USERNAME" \
  -p "$GIT_PASSWORD"

#####################################################
# Step 2: Setup AWS profile
#####################################################
cat >"$AWS_CONFIG_FILE" <<EOF
[profile ci]
role_arn = $AWS_ROLE_ARN
web_identity_token_file = /var/run/secrets/eks.amazonaws.com/serviceaccount/token
role_session_name = ci-runner
EOF

#####################################################
# Step 3: Setup the kubeconfig context
#####################################################
kubectl config set-cluster ci \
  --server="https://$KUBERNETES_SERVICE_HOST" \
  --certificate-authority /var/run/secrets/kubernetes.io/serviceaccount/ca.crt --embed-certs
kubectl config set-credentials ci --token="$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)"
kubectl config set-context ci --cluster=ci --user=ci --namespace=default

#####################################################
# Step 4: Setup vault
#####################################################
VAULT_TOKEN=$(vault write auth/kubernetes/login role="$VAULT_ROLE" jwt="$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" -format=json | jq -r '.auth.client_token')
export VAULT_TOKEN

#####################################################
# Step 5: Update sops-encrypted files so the runner can decrypt them
#####################################################
pf-sops-set-profile --directory . --profile ci

#####################################################
# Step 6: Use terragrunt to deploy the IaC
#####################################################
mkdir -p "$TF_PLUGIN_CACHE_DIR"
cd "$TF_APPLY_DIR"
terragrunt run-all apply \
  --terragrunt-ignore-external-dependencies \
  --terragrunt-download-dir /tmp/.terragrunt \
  --terragrunt-non-interactive \
  --terragrunt-fetch-dependency-output-from-state \
  --terragrunt-provider-cache \
  --terragrunt-provider-cache-dir "$TF_PLUGIN_CACHE_DIR" \
  --terragrunt-parallelism 5
