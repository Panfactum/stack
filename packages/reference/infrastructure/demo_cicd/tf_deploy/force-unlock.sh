#!/usr/bin/env bash

set -eo pipefail


# Set the host name as that gets set as the tf lock holder
# that we will use in the emergency unlock logic
HOSTNAME=$(md5sum <<< "$PF_REPO_URL$TF_APPLY_DIR" | cut -f 1 -d' ')


