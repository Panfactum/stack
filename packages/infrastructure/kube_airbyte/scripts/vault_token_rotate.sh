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

echo "Successfully extracted token of length: $(echo $CLIENT_TOKEN | wc -c) characters"

# Create a kubernetes secret with the token using curl
echo "Creating Kubernetes secret with Vault token..."

K8S_API_SERVER="https://kubernetes.default.svc"
CACERT="/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"
TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)

# Base64 encode the token
BASE64_TOKEN=$(echo -n "$CLIENT_TOKEN" | base64 | tr -d '\n')

# Create the secret JSON
SECRET_JSON=$(
  cat <<JSON
{
  "apiVersion": "v1",
  "kind": "Secret",
  "metadata": {
    "name": "airbyte-vault-token",
    "namespace": "$NAMESPACE"
  },
  "type": "Opaque",
  "data": {
    "token": "$BASE64_TOKEN"
  }
}
JSON
)

# Check if the secret already exists
echo "Checking if secret exists..."
SECRET_EXISTS=$(curl -s -o /dev/null -w "%{http_code}" \
  --cacert $CACERT \
  --header "Authorization: Bearer $TOKEN" \
  "$K8S_API_SERVER/api/v1/namespaces/$NAMESPACE/secrets/airbyte-vault-token")

echo "Secret exists check returned status: $SECRET_EXISTS"

# Create or update the secret based on existence
if [ "$SECRET_EXISTS" = "200" ]; then
  # Update existing secret
  echo "Secret exists, updating..."
  UPDATE_RESULT=$(curl -k -w "\nStatus code: %%{http_code}\nResponse body:\n%%{response_body}\n" \
    --request PUT \
    --cacert $CACERT \
    --header "Authorization: Bearer $TOKEN" \
    --header "Content-Type: application/json" \
    --data "$SECRET_JSON" \
    "$K8S_API_SERVER/api/v1/namespaces/$NAMESPACE/secrets/airbyte-vault-token")

  echo "Update result: $PATCH_RESULT"
else
  # Create new secret
  echo "Creating new secret..."
  CREATE_RESULT=$(curl -s -w "\nStatus code: %%{http_code}" \
    --cacert $CACERT \
    --header "Authorization: Bearer $TOKEN" \
    --header "Content-Type: application/json" \
    --data "$SECRET_JSON" \
    "$K8S_API_SERVER/api/v1/namespaces/$NAMESPACE/secrets")

  echo "Create result: $CREATE_RESULT"
fi

echo "Vault token process completed"
