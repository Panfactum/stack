#!/usr/bin/env bash

set -eo pipefail

#####################################################
# Step 1: Clone the repo
#####################################################

cd /code
git clone https://github.com/Panfactum/stack.git --depth=1
cd "$DEVENV_ROOT"
git fetch origin "$GIT_REF"
git checkout "$GIT_REF"
git lfs install --local
git lfs pull

#####################################################
# Step 2: Setup AWS profile
#####################################################
export AWS_CONFIG_FILE="/.aws/config"
cat >"$AWS_CONFIG_FILE" <<EOF
[profile ci]
role_arn = $AWS_ROLE_ARN
web_identity_token_file = /var/run/secrets/eks.amazonaws.com/serviceaccount/token
role_session_name = ci-runner
EOF

#####################################################
# Step 3: Setup the kubeconfig context and various kube-related variables
#####################################################
export KUBE_CONFIG_PATH="/.kube/config"
export KUBECONFIG="/.kube/config"
export HELM_REPOSITORY_CACHE="/tmp/.helm"
export HELM_CACHE_HOME="/tmp/.helm"
export HELM_DATA_HOME="/tmp/.helm"
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

# TODO: Move to built-in command
update_sops() {
  local file="$1"

  # Check if the file contains sops.kms
  if yq -e '.sops.kms' "$file" > /dev/null 2>&1; then
    echo "Processing $file"

    # Use yq to update aws_profile value to ci
    yq -Yi '(.sops.kms[] | select(has("aws_profile"))).aws_profile = "ci"' "$file"
  fi
}

find "$PF_ENVIRONMENTS_DIR" -type f -name "*.yaml" | while read -r file; do
  update_sops "$file"
done

#####################################################
# Step 5: Deploy terragrunt
#####################################################

# Set the host name as that gets set as the tf lock holder
# that we will use in the emergency unlock logic
HOSTNAME=$(md5sum <<< "$PF_REPO_URL$TF_APPLY_DIR" | cut -f 1 -d' ')
export HOSTNAME

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


