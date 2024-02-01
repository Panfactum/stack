#!/usr/bin/env bash

# This script starts a tunnel to an internal network service
# to allow network connectivity during local development

set -eo pipefail

SSH_DIR="$DEVENV_ROOT/.ssh"

# Step 1: Verify that the user has keyfiles in this repo

if [[ ! -f "$SSH_DIR/id_ed25519" || ! -f "$SSH_DIR/id_ed25119.pub" ]]; then
  rm -f "$SSH_DIR/id_ed25519" "$SSH_DIR/id_ed25119.pub"
  ssh-keygen -q -t ed25519 -N "" -C "bastion key" -f "$SSH_DIR/id_ed25519"
fi

# Step 2: Get a vault token for signing
VAULT_TOKEN=$(get-vault-token)
export VAULT_TOKEN

# Step 3: Sign our keys with vault to allow access to the bastion
# We don't necessarily need to regenerate this _every_ time, but it makes
# the script idempotent and easier to maintain
vault write -field=signed_key ssh/sign/default public_key=@"$SSH_DIR/id_ed25519.pub" >"$SSH_DIR/signed-cert.pub"

# Step 4: Select a remote service
# TODO: Make this an interactive fetcher for properly annotated services
REMOTE_SERVICE="$1"

# Step 5: Select a local port
LOCAL_PORT="$2"
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

# Some notes on this command
# - We disable the ssh-agent b/c we don't want to force users to have
#   to enter a password on the private key. The private key isn't sensitive
#   as it is not usable without the certs which expire in 24 hours
#
# - We use our own known_hosts file committed to this repo so that we can
#   ensure that users are never connecting to a spoofed host
#
# - We disable the autossh monitoring port (-M 0) b/c we rely on the built-in ssh
#   server monitoring
#
# - 45459 is the remote bastion port that we use for all bastions
#
# - (-N) we do not grant pty access on the bastion hosts as they are meant
#   simply for network tunneling

# Allows autossh to retry even if the first connection fails
export AUTOSSH_GATETIME=0
autossh \
  -M 0 \
  -o UserKnownHostsFile="$SSH_DIR/known_hosts" \
  -o IdentitiesOnly=yes \
  -o IdentityAgent=none \
  -o ServerAliveInterval=2 \
  -o ServerAliveCountMax=3 \
  -o ConnectTimeout=1 \
  -N \
  -i "$SSH_DIR/id_ed25519" -i "$SSH_DIR/signed-cert.pub" \
  -L "localhost:$LOCAL_PORT:$REMOTE_SERVICE" \
  -p 45459 \
  panfactum@bastion.dev.panfactum.com
