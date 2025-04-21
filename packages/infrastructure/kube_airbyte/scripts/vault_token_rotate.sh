#!/bin/sh

echo "Using Vault address: $VAULT_ADDR" >&2
echo "Using Vault role: $VAULT_ROLE" >&2
echo "Using namespace: $NAMESPACE" >&2

# Get the JWT token from the service account
JWT=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)

# Test connectivity to Vault
echo "Testing Vault connectivity..." >&2
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$VAULT_ADDR/v1/sys/health")
echo "Vault health status: $HEALTH_STATUS" >&2

if [ "$HEALTH_STATUS" != "200" ] && [ "$HEALTH_STATUS" != "429" ] && [ "$HEALTH_STATUS" != "472" ] && [ "$HEALTH_STATUS" != "473" ]; then
  echo "Failed to connect to Vault at $VAULT_ADDR" >&2
  exit 1
fi

# Login to Vault using Kubernetes auth with debug info
echo "Authenticating with Vault at $VAULT_ADDR/v1/auth/kubernetes/login..." >&2
echo "Using role: $VAULT_ROLE" >&2

# Create the JSON payload for the request
AUTH_PAYLOAD=$(
  cat <<PAYLOAD
{
  "jwt": "$JWT",
  "role": "$VAULT_ROLE",
  "ttl": "48h"
}
PAYLOAD
)

# Perform the login request
LOGIN_RESPONSE=$(curl -s \
  --request POST \
  --header "Content-Type: application/json" \
  --data "$AUTH_PAYLOAD" \
  "$VAULT_ADDR/v1/auth/kubernetes/login")

CLIENT_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.auth.client_token')

if [ -z "$CLIENT_TOKEN" ] || [ "$CLIENT_TOKEN" = "null" ]; then
  echo "Failed to get client token from Vault" >&2
  echo "Login response: $LOGIN_RESPONSE" >&2
  exit 1
fi

# Update the existing Kubernetes secret with the Vault token
echo "Updating Kubernetes secret 'airbyte-vault-secret' with Vault token..." >&2

SECRET_NAME="airbyte-vault-secret"
SECRET_KEY="token"

# Create or update the secret using kubectl apply
echo "Applying secret '$SECRET_NAME' in namespace '$NAMESPACE'..."
printf "%s" "$CLIENT_TOKEN" | kubectl create secret generic "$SECRET_NAME" \
  --dry-run=client \
  --from-literal="$SECRET_KEY=$CLIENT_TOKEN" \
  -o yaml | kubectl apply -n "$NAMESPACE" -f -

APPLY_RESULT=$?
echo "Apply result exit code: $APPLY_RESULT" >&2

echo "Vault token rotation completed" >&2
