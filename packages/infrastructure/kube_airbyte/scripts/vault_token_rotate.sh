#!/bin/sh

echo "Using Vault address: $VAULT_ADDR"
echo "Using Vault role: $VAULT_ROLE"
echo "Using namespace: $NAMESPACE"

# Get the JWT token from the service account
JWT=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
echo "JWT token length: $(echo $JWT | wc -c) characters"

# Test connectivity to Vault
echo "Testing Vault connectivity..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $VAULT_ADDR/v1/sys/health)
echo "Vault health status: $HEALTH_STATUS"

if [ "$HEALTH_STATUS" != "200" ] && [ "$HEALTH_STATUS" != "429" ] && [ "$HEALTH_STATUS" != "472" ] && [ "$HEALTH_STATUS" != "473" ]; then
  echo "Failed to connect to Vault at $VAULT_ADDR"
  exit 1
fi

# Login to Vault using Kubernetes auth with debug info
echo "Authenticating with Vault at $VAULT_ADDR/v1/auth/kubernetes/login..."
echo "Using role: $VAULT_ROLE"

# Create the JSON payload for the request
AUTH_PAYLOAD=$(
  cat <<PAYLOAD
{
  "jwt": "$JWT",
  "role": "$VAULT_ROLE"
}
PAYLOAD
)

# Perform the login request
LOGIN_RESPONSE=$(curl -s \
  --request POST \
  --header "Content-Type: application/json" \
  --data "$AUTH_PAYLOAD" \
  $VAULT_ADDR/v1/auth/kubernetes/login)

# Pattern: look for "client_token":"some-token", extract the token part
CLIENT_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"client_token":"[^"]*"' | sed 's/"client_token":"//;s/"$//')

if [ -z "$CLIENT_TOKEN" ]; then
  echo "Failed to get client token from Vault"
  echo "Login response: $LOGIN_RESPONSE"
  exit 1
fi

echo "xSuccessfully extracted token of length: $(echo $CLIENT_TOKEN | wc -c) characters"

# Update the existing Kubernetes secret with the Vault token
echo "Updating Kubernetes secret 'airbyte-config-secrets' with Vault token..."

K8S_API_SERVER="https://kubernetes.default.svc"
CACERT="/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"
K8S_TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
NAMESPACE="${NAMESPACE:-default}" # Set default namespace if not provided
SECRET_NAME="airbyte-vault-secret"
SECRET_KEY="token"

# Base64 encode the token
BASE64_TOKEN=$(echo -n "$CLIENT_TOKEN" | base64 | tr -d '\n')

# Prepare the patch JSON
PATCH_JSON=$(
  cat <<JSON
{
  "data": {
    "$SECRET_KEY": "$BASE64_TOKEN"
  }
}
JSON
)

# Check if the secret already exists
echo "Checking if secret exists..."
SECRET_EXISTS=$(curl -s -o /dev/null -w "%{http_code}" \
  --cacert $CACERT \
  --header "Authorization: Bearer $K8S_TOKEN" \
  "$K8S_API_SERVER/api/v1/namespaces/$NAMESPACE/secrets/$SECRET_NAME")

echo "Secret exists check returned status: $SECRET_EXISTS"

if [ "$SECRET_EXISTS" = "200" ]; then
  # Update the secret using patch
  echo "Patching secret '$SECRET_NAME' in namespace '$NAMESPACE'..."
  PATCH_RESULT=$(curl -k -X PATCH -w "\nStatus code: %{http_code}\nResponse body:\n%{response_body}\n" \
    --cacert "$CACERT" \
    --header "Authorization: Bearer $K8S_TOKEN" \
    --header "Content-Type: application/strategic-merge-patch+json" \
    --data "$PATCH_JSON" \
    "$K8S_API_SERVER/api/v1/namespaces/$NAMESPACE/secrets/$SECRET_NAME")

  echo "Patch result: $PATCH_RESULT"
else
  CREATE_PAYLOAD=$(
    cat <<JSON
{
  "apiVersion": "v1",
  "kind": "Secret",
  "metadata": {
    "name": "$SECRET_NAME",
    "namespace": "$NAMESPACE"
  },
  "type": "Opaque",
  "data": {
    "$SECRET_KEY": "$BASE64_TOKEN"
  }
}
JSON
  )
  # Create new secret
  echo "Creating new secret..."
  CREATE_RESULT=$(curl -s -w "\nStatus code: %{http_code}" \
    --cacert $CACERT \
    --header "Authorization: Bearer $K8S_TOKEN" \
    --header "Content-Type: application/json" \
    --request POST \
    --data "$CREATE_PAYLOAD" \
    "$K8S_API_SERVER/api/v1/namespaces/$NAMESPACE/secrets")

  echo "Create result: $CREATE_RESULT"
fi

echo "Vault token rotation completed"
