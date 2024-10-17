#!/usr/bin/env bash

set -eo pipefail

# Purpose: Adds the standard .ssh configuration files
REPO_VARIABLES=$(pf-get-repo-variables)
SSH_DIR=$(echo "$REPO_VARIABLES" | jq -r '.ssh_dir')
ENVIRONMENTS_DIR=$(echo "$REPO_VARIABLES" | jq -r '.environments_dir')

if [[ $1 == "-b" ]] || [[ $1 == "--build" ]]; then
  BUILD_KNOWN_HOSTS="1"
else
  BUILD_KNOWN_HOSTS="0"
fi

############################################################
## Step 1: Copy the static files
############################################################

destination=$SSH_DIR
source=$(dirname "$(dirname "$(realpath "$0")")")/files/ssh

mkdir -p "$destination"

rsync -rp --chmod=Du=rwx,Dg=rx,Do=rx,Fu=rw,Fg=r,Fo=r "$source"/ "$destination"/

############################################################
## Step 2: Dynamically configure known_hosts
############################################################

CONFIG_FILE="$SSH_DIR/config.yaml"
KNOWN_HOSTS_FILE="$SSH_DIR/known_hosts"
CONNECTION_INFO_FILE="$SSH_DIR/connection_info"

if [[ $BUILD_KNOWN_HOSTS == "1" ]]; then
  if [[ -f $CONFIG_FILE ]]; then

    # Remove the old known_hosts file
    if [[ -f $KNOWN_HOSTS_FILE ]]; then
      rm "$KNOWN_HOSTS_FILE"
    fi

    # Remove the old connection_info file
    if [[ -f $CONNECTION_INFO_FILE ]]; then
      rm "$CONNECTION_INFO_FILE"
    fi

    # Count the number of bastions
    NUMBER_OF_BASTIONS=$(yq '.bastions | length' "$CONFIG_FILE")

    # Iterate over each bastion
    for ((i = 0; i < NUMBER_OF_BASTIONS; i++)); do

      # Extract module for the bastion
      MODULE=$(yq -r ".bastions[$i].module" "$CONFIG_FILE")
      NAME=$(yq -r ".bastions[$i].name" "$CONFIG_FILE")
      MODULE_PATH="$ENVIRONMENTS_DIR/$MODULE"

      if [[ ! -d $MODULE_PATH ]]; then
        echo "Error: No module at $MODULE_PATH!" >&2
        exit 1
      fi

      echo "Updating $KNOWN_HOSTS_FILE and $CONNECTION_INFO_FILE with values from $MODULE..." >&2

      # Extract the module outputs
      MODULE_OUTPUT="$(terragrunt output --json --terragrunt-working-dir="$MODULE_PATH")"
      PUBLIC_KEY="$(echo "$MODULE_OUTPUT" | jq -r '.bastion_host_public_key.value')"
      DOMAINS="$(echo "$MODULE_OUTPUT" | jq -r '.bastion_domains.value')"
      PORT="$(echo "$MODULE_OUTPUT" | jq -r '.bastion_port.value')"

      # Add the hosts to the known_hosts file
      NUMBER_OF_DOMAINS=$(echo "$DOMAINS" | jq -r 'length')
      for ((j = 0; j < NUMBER_OF_DOMAINS; j++)); do
        DOMAIN=$(echo "$DOMAINS" | jq -r ".[$j]")
        echo "[$DOMAIN]:$PORT $PUBLIC_KEY" >>"$KNOWN_HOSTS_FILE"
        echo "$NAME $DOMAIN $PORT" >>"$CONNECTION_INFO_FILE"
      done
    done

    echo "All hosts in $KNOWN_HOSTS_FILE and $CONNECTION_INFO_FILE updated." >&2

  else
    echo "Warning: No configuration file exists at $CONFIG_FILE Skipping credential setup..." >&2
  fi
fi

# Save the state hash
pf-get-ssh-state-hash >"$SSH_DIR/state.lock"

echo -e "ssh config files in $SSH_DIR were updated.\n" 1>&2

if [[ $PF_SKIP_CHECK_REPO_SETUP != 1 ]]; then
  pf-check-repo-setup
fi
