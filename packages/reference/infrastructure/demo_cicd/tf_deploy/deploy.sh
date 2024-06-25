#!/usr/bin/env bash

set -eo pipefail

#####################################################
# Step 1: Clone the repo
#####################################################

cd /code
git clone https://github.com/Panfactum/stack.git --depth=1
cd stack
git fetch origin "$GIT_REF"
git checkout "$GIT_REF"
git lfs install --local
git lfs pull

#####################################################
# Step 2: Setup AWS profile
#####################################################

cat >"/.aws/config" <<EOF
[profile ci]
role_arn = $AWS_ROLE_ARN
web_identity_token_file = /var/run/secrets/eks.amazonaws.com/serviceaccount/token
role_session_name = ci-runner
EOF

#####################################################
# Step 3: Setup the kubeconfig Context
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
# Step 5: Deploy terragrunt
#####################################################
cd packages/reference/environments/production/us-east-2

terragrunt run-all apply \
  --terragrunt-ignore-external-dependencies \
  --terragrunt-download-dir /terragrunt \
  --terragrunt-non-interactive \
  --terragrunt-fetch-dependency-output-from-state


