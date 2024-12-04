#!/usr/bin/env bash

# This script:
# 1. Presents the user with all available database in the cluster (optionally scoped by namespace)
# 2. Presents the user with the available roles for the selected database
# 3. Presents credentials for the selected role
# 4. Opens a tunnel to the selected database

set -eo pipefail

# Use this trap to ensure that database credentials are only
# valid while the tunnel is active
handle_exit() {
  if [[ -n $LEASE_ID ]]; then
    echo "Tunnel terminated. Revoking database credentials..." >&2
    vault lease revoke "$LEASE_ID"
  fi
}
trap 'handle_exit' EXIT

####################################################################
# Step 0: Error checking
####################################################################
pf-check-ssh

####################################################################
# Step 1: Variable parsing
####################################################################

# Initialize our own variables:
LOCAL_PORT=""
NAMESPACE=""

# Define the function to display the usage
usage() {
  echo "Usage: pf-db-tunnel [-l <local-port>] [-n <namespace>]" >&2
  echo "       pf-db-tunnel [--local-port <local-port>] [--namespace namespace]" >&2
  echo "" >&2
  echo "<local-port>: (Optional) The local port to bind to." >&2
  echo "" >&2
  echo "<namespace>: (Optional) Only show databases in this namespace" >&2
  exit 1
}

# Parse command line arguments
TEMP=$(getopt -o l:n: --long local-port:,namespace: -- "$@")

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
  -l | --local-port)
    LOCAL_PORT="$2"
    shift 2
    ;;
  -n | --namespace)
    NAMESPACE="$2"
    shift 2
    ;;
  --)
    shift
    break
    ;;
  *)
    usage
    ;;
  esac
done

####################################################################
# Step 1: Get the Vault Address
####################################################################
KUBE_CONTEXT="$(kubectl config current-context)"
VAULT_ADDR=$(kubectl get sts -n vault -o jsonpath="{.items[?(@.metadata.name=='vault')].metadata.annotations['panfactum\.com\/vault-addr']}")

if [[ -z $VAULT_ADDR ]]; then
  echo "Unable to retrieve Vault address in $KUBE_CONTEXT" >&2
  exit 1
fi

echo "Connecting to Vault in $KUBE_CONTEXT..." >&2
export VAULT_ADDR

####################################################################
# Step 2: Get the Vault token
####################################################################

VAULT_TOKEN=$(pf-get-vault-token)
echo "Retrieved Vault token." >&2

####################################################################
# Step 3: List all the databases for the current kubectx; allow the user to select one
####################################################################

if [[ -n $NAMESPACE ]]; then
  NAMESPACE_FLAG="-n=$NAMESPACE"
  echo "Searching for all databases in $KUBE_CONTEXT in namespace $NAMESPACE..." >&2
else
  NAMESPACE_FLAG="--all-namespaces"
  echo "Searching for all databases in $KUBE_CONTEXT..." >&2
fi

PG_DBS=$(kubectl get clusters.postgresql.cnpg.io "$NAMESPACE_FLAG" -o custom-columns=NAMESPACE:.metadata.namespace,NAME:.metadata.name --no-headers | awk '{printf "%-15s %-25s %-25s\n", "PostgreSQL", $1, $2}')
STS=$(kubectl get sts "$NAMESPACE_FLAG" -o json)
REDIS_DBS="$(echo "$STS" | jq -r '.items[] | select(.metadata.annotations["panfactum.com/db-type"]=="Redis") | "\(.metadata.namespace) \(.metadata.name)"' | awk '{printf "%-15s %-25s %-25s\n", "Redis", $1, $2}')"
NATS_DBS="$(echo "$STS" | jq -r '.items[] | select(.metadata.annotations["panfactum.com/db-type"]=="NATS") | "\(.metadata.namespace) \(.metadata.name)"' | awk '{printf "%-15s %-25s %-25s\n", "NATS", $1, $2}')"
DBS="$PG_DBS\n$REDIS_DBS\n$NATS_DBS"
HEADER=$(printf "%-15s %-25s %-25s" "TYPE" "NAMESPACE" "NAME")

if [[ -z $DBS ]]; then
  echo "No databases found." >&2
  exit 1
fi

SELECTED_DB=$(echo -e "$HEADER\n$DBS" | fzf --height=50% --border --prompt="Select a database: " --header-lines=1)

if [[ -z $SELECTED_DB ]]; then
  echo "No database selected." >&2
  exit 1
fi

SELECTED_DB_TYPE=$(echo "$SELECTED_DB" | awk '{print $1}')
SELECTED_DB_NAMESPACE=$(echo "$SELECTED_DB" | awk '{print $2}')
SELECTED_DB_NAME=$(echo "$SELECTED_DB" | awk '{print $3}')

####################################################################
# Step 4: Find the database metadata
####################################################################

KUBE_TYPE=""

if [[ $SELECTED_DB_TYPE == "PostgreSQL" ]]; then
  KUBE_TYPE="clusters.postgresql.cnpg.io"
elif [[ $SELECTED_DB_TYPE == "Redis" ]] || [[ $SELECTED_DB_TYPE == "NATS" ]]; then
  KUBE_TYPE="statefulset"
else
  echo "Unknown database type $SELECTED_DB_TYPE." >&2
  exit 1
fi

ANNOTATIONS=$(kubectl get "$KUBE_TYPE" -n "$SELECTED_DB_NAMESPACE" -o jsonpath="{.items[?(@.metadata.name=='$SELECTED_DB_NAME')].metadata.annotations}" 2>/dev/null)

if [[ -z $ANNOTATIONS ]]; then
  echo "Unable to retrieve annotations for $KUBE_TYPE $SELECTED_DB_NAME.$SELECTED_DB_NAMESPACE" >&2
  exit 1
fi

SUPERUSER_ROLE=$(echo "$ANNOTATIONS" | jq -r '.["panfactum.com/superuser-role"]')
READER_ROLE=$(echo "$ANNOTATIONS" | jq -r '.["panfactum.com/reader-role"]')
ADMIN_ROLE=$(echo "$ANNOTATIONS" | jq -r '.["panfactum.com/admin-role"]')
SERVICE=$(echo "$ANNOTATIONS" | jq -r '.["panfactum.com/service"]')
SERVICE_PORT=$(echo "$ANNOTATIONS" | jq -r '.["panfactum.com/service-port"]')

####################################################################
# Step 5: Select a database role
####################################################################

SELECTED_ROLE=$(echo -e "Superuser\nAdmin\nReader" | fzf --height=25% --border --prompt="Select a role: ")

####################################################################
# Step 6: Get the database credentials
####################################################################

echo "Retrieving $SELECTED_ROLE credentials for $SELECTED_DB_NAME.$SELECTED_DB_NAMESPACE from Vault at $VAULT_ADDR..." >&2
ACTUAL_ROLE=""

case "$SELECTED_ROLE" in
Superuser)
  ACTUAL_ROLE="$SUPERUSER_ROLE"
  ;;
Reader)
  ACTUAL_ROLE="$READER_ROLE"
  ;;
Admin)
  ACTUAL_ROLE="$ADMIN_ROLE"
  ;;
*)
  exit 1
  ;;
esac

export VAULT_TOKEN

if [[ $SELECTED_DB_TYPE == "NATS" ]]; then
  CREDS=$(vault write -format=json "pki/internal/issue/$ACTUAL_ROLE" common_name="${ACTUAL_ROLE#nats-}")

  if [[ -z $CREDS ]]; then
    echo "Unable to retrieve credentials at $VAULT_ADDR for $ACTUAL_ROLE" >&2
    exit 1
  fi

  NATS_DIR=$(pf-get-repo-variables | jq -r .nats_dir)
  mkdir -p "$NATS_DIR"

  CA_FILE="$NATS_DIR/$SELECTED_DB_NAME.$SELECTED_DB_NAMESPACE.ca.crt"
  CERT_FILE="$NATS_DIR/$SELECTED_DB_NAME.$SELECTED_DB_NAMESPACE.tls.crt"
  KEY_FILE="$NATS_DIR/$SELECTED_DB_NAME.$SELECTED_DB_NAMESPACE.tls.key"

  echo "$CREDS" | jq -r .data.issuing_ca >"$CA_FILE"
  echo "$CREDS" | jq -r .data.certificate >"$CERT_FILE"
  echo "$CREDS" | jq -r .data.private_key >"$KEY_FILE"
else
  CREDS="$(pf-get-db-creds --role "$ACTUAL_ROLE")"

  if [[ -z $CREDS ]]; then
    echo "Unable to retrieve credentials at $VAULT_ADDR for $ACTUAL_ROLE" >&2
    exit 1
  fi

  USERNAME=$(echo -n "$CREDS" | grep username | awk '{print $2}')
  PASSWORD=$(echo -n "$CREDS" | grep password | awk '{print $2}')
  DURATION=$(echo -n "$CREDS" | grep lease_duration | awk '{print $2}')
  LEASE_ID=$(echo -n "$CREDS" | grep lease_id | awk '{print $2}')
fi

####################################################################
# Step 7: Pick a local port
####################################################################

if [[ ! $LOCAL_PORT =~ ^[0-9]+$ ]] || ((LOCAL_PORT < 1024 || LOCAL_PORT > 65535)); then
  while :; do
    read -rp "Enter a local port for the tunnel between 1024 and 65535: " LOCAL_PORT
    [[ $LOCAL_PORT =~ ^[0-9]+$ ]] || {
      echo "Not a number!" >&2
      continue
    }
    if ((LOCAL_PORT > 1024 && LOCAL_PORT < 65535)); then
      break
    else
      echo "port out of range, try again" >&2
    fi
  done
fi

####################################################################
# Step 8: Launch the tunnel
####################################################################

if [[ $SELECTED_DB_TYPE == "NATS" ]]; then
  echo "Credentials saved to $NATS_DIR and will expire in 16 hours." >&2
  echo "" >&2
  echo "To connect using the NATS CLI, set the following environment variables:" >&2
  echo "" >&2
  echo "export NATS_CA=$CA_FILE" >&2
  echo "export NATS_CERT=$CERT_FILE" >&2
  echo "export NATS_KEY=$KEY_FILE" >&2
  echo "export NATS_URL=tls://127.0.0.1:$LOCAL_PORT"
  echo "" >&2
  echo "If using a different client, configure TLS authentication using the above values." >&2
  echo "" >&2
  echo "" >&2
else
  echo "" >&2
  echo "Credentials will expire in $DURATION or until tunnel termination:" >&2
  echo "" >&2
  echo "Username: $USERNAME" >&2
  echo "Password: $PASSWORD" >&2
  echo "" >&2
  echo "" >&2
fi

echo "Running a tunnel on 127.0.0.1:$LOCAL_PORT to $SELECTED_DB_TYPE database $SELECTED_DB_NAME.$SELECTED_DB_NAMESPACE via $SERVICE:$SERVICE_PORT!" >&2

pf-tunnel -b "$KUBE_CONTEXT" -r "$SERVICE:$SERVICE_PORT" -l "$LOCAL_PORT"
