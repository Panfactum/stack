#!/usr/bin/env bash

# This script starts a tunnel to an internal network service
# to allow network connectivity during local development

set -eo pipefail

####################################################################
# Step 0: Pull in ssh vars
####################################################################

# shellcheck disable=SC1091
source pf-check-ssh

####################################################################
# Step 1: Variable parsing
####################################################################

REPO_VARIABLES=$(pf-get-repo-variables)
SSH_DIR=$(echo "$REPO_VARIABLES" | jq -r '.ssh_dir')

# Initialize our own variables:
BASTION=""
LOCAL_PORT=""
REMOTE_ADDRESS=""

# Define the function to display the usage
usage() {
  echo "Usage: pf-tunnel -b <bastion> -r <remote-address> [-l <local-port>]" >&2
  echo "       pf-tunnel --bastion <bastion> --remote-address <remote-address> [--local-port <local-port>]" >&2
  echo "" >&2
  echo "<bastion>: The name of the bastion to use as listed in $SSH_DIR/config.yaml." >&2
  echo "" >&2
  echo "<remote-address>: The remote address to connect with. Must contain the hostname and the port. (example.com:443)" >&2
  echo "" >&2
  echo "<local-port>: (Optional) The local port to bind to." >&2
  exit 1
}

# Parse command line arguments
TEMP=$(getopt -o b:l:r: --long bastion:,local-port:,remote-address: -n 'example.bash' -- "$@")

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
  -b | --bastion)
    BASTION="$2"
    shift 2
    ;;
  -l | --local-port)
    LOCAL_PORT="$2"
    shift 2
    ;;
  -r | --remote-address)
    REMOTE_ADDRESS="$2"
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

# Check for mandatory options
if [[ -z $BASTION ]]; then
  echo "bastion is a required argument" >&2
  exit 1
elif [[ -z $REMOTE_ADDRESS ]]; then
  echo "remote-address is a required argument" >&2
  exit 1
fi

####################################################################
# Step 2: Find the bastion address and port number
####################################################################

read -r BASTION_DOMAIN BASTION_PORT <<<"$(grep -m 1 "$BASTION " "$CONNECTION_INFO_FILE" | awk '{print $2, $3}')"

if [[ -z $BASTION_DOMAIN || -z $BASTION_PORT ]]; then
  echo "Error: $BASTION not found in $CONNECTION_INFO_FILE. Ensure this name is correct or run pf-update-ssh to regenerate this file." >&2
fi

####################################################################
# Step 3: Verify that the user has keyfiles in this repo
####################################################################

KEY_FILE="$SSH_DIR/id_ed25519_$BASTION"
PUBLIC_KEY_FILE="$KEY_FILE.pub"
SIGNED_PUBLIC_KEY_FILE="${KEY_FILE}_signed.pub"

if [[ ! -s $KEY_FILE || ! -s $PUBLIC_KEY_FILE || ! -s $SIGNED_PUBLIC_KEY_FILE ]]; then
  rm -f "$KEY_FILE" "$PUBLIC_KEY_FILE" "$SIGNED_PUBLIC_KEY_FILE"
  ssh-keygen -q -t ed25519 -N "" -C "$BASTION" -f "$KEY_FILE"
fi

####################################################################
# Step 4: Get a vault token for signing
####################################################################
VAULT_ADDR=$(yq -r ".bastions[] | select(.name == \"$BASTION\") | .vault" "$CONFIG_FILE")

if [[ -z $VAULT_ADDR ]]; then
  echo "No bastion named $BASTION found in $CONFIG_FILE!" >&2
  exit 1
fi

export VAULT_ADDR
VAULT_TOKEN=$(pf-get-vault-token)
export VAULT_TOKEN

####################################################################
# Step 5: Sign our keys with vault to allow access to the bastion
# We don't necessarily need to regenerate this _every_ time, but it makes
# the script idempotent and easier to maintain
####################################################################

vault write -field=signed_key ssh/sign/default public_key=@"$PUBLIC_KEY_FILE" >"$SIGNED_PUBLIC_KEY_FILE"

####################################################################
# Step 6: Select a local port
####################################################################

if [[ ! $LOCAL_PORT =~ ^[0-9]+$ ]] || ((LOCAL_PORT < 1024 || LOCAL_PORT > 65535)); then
  while :; do
    read -rp "Enter a local port for the tunnel between 1024 and 65535: " LOCAL_PORT
    [[ $LOCAL_PORT =~ ^[0-9]+$ ]] || {
      echo "Not a number!"
      continue
    }
    if ((LOCAL_PORT > 1024 && LOCAL_PORT < 65535)); then
      break
    else
      echo "port out of range, try again"
    fi
  done
fi

####################################################################
# Step 7: Establish the tunnel
####################################################################

# Some notes on this command
# - We disable the ssh-agent b/c we don't want to force users to have
#   to enter a password on the private key. The private key isn't sensitive
#   as it is not usable without the certs which expire regularly
#
# - We use our own known_hosts file committed to this repo so that we can
#   ensure that users are never connecting to a spoofed host
#
# - We disable the autossh monitoring port (-M 0) b/c we rely on the built-in ssh
#   server monitoring
#
# - (-N) we do not grant pty access on the bastion hosts as they are meant
#   simply for network tunneling

# Allows autossh to retry even if the first connection fails
export AUTOSSH_GATETIME=0
autossh \
  -M 0 \
  -o UserKnownHostsFile="$KNOWN_HOSTS_FILE" \
  -o IdentitiesOnly=yes \
  -o IdentityAgent=none \
  -o ServerAliveInterval=2 \
  -o ServerAliveCountMax=3 \
  -o ConnectTimeout=1 \
  -N \
  -i "$KEY_FILE" -i "$SIGNED_PUBLIC_KEY_FILE" \
  -L "localhost:$LOCAL_PORT:$REMOTE_ADDRESS" \
  -p "$BASTION_PORT" \
  "panfactum@$BASTION_DOMAIN"
