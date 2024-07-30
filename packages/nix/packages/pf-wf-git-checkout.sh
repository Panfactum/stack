#!/usr/bin/env bash

set -eo pipefail

####################################################################
# Step 1: Variable parsing
####################################################################
REPO=""
GIT_REF=""
USERNAME=""
PASSWORD=""

usage() {
  echo "Efficiently checks out a git repository at a specific commit for use in a CI / CD pipeline" >&2
  echo "" >&2
  echo "Usage: pf-cicd-git-checkout -r <repo-url>  -c <git-ref> [-u <git-username>] [-p <git-password>]" >&2
  echo "       pf-cicd-git-checkout --repo <repo-url> --checkout <git-ref> [--username <git-username>] [--password <git-password>]" >&2
  echo "" >&2
  echo "<repo-url>: The repository URL to clone. Must not contain a protocol specifier (ex: github.com/panfactum/stack)" >&2
  echo "" >&2
  echo "<git-ref>: The git ref to checkout from the repository." >&2
  echo "" >&2
  echo "<git-username>: (Optional) The username to use during authentication" >&2
  echo "" >&2
  echo "<git-password>: (Optional) The password to use for authentication" >&2
  exit 1
}

# Parse command line arguments
TEMP=$(getopt -o r:c:u:p: --long repo:,checkout:,username:,password: -- "$@")

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
  -r | --repo)
    REPO="$2"
    shift 2
    ;;
  -c | --checkout)
    GIT_REF="$2"
    shift 2
    ;;
  -p | --password)
    PASSWORD="$2"
    shift 2
    ;;
  -u | --username)
    USERNAME="$2"
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

if [[ -z $REPO ]]; then
  echo "--repo is a required argument." >&2
  exit 1
elif [[ -z $GIT_REF ]]; then
  echo "--checkout is a required argument." >&2
  exit 1
fi

if [[ -n $USERNAME ]] && [[ -z $PASSWORD ]]; then
  echo "If --username is supplied, a --password must also be supplied." >&2
  exit 1
fi

####################################################################
# Step 2: Set up the username / password authentication (if applicable)
####################################################################
if [[ -n $USERNAME ]]; then
  git config --global url."https://$USERNAME:$PASSWORD@$REPO.git".InsteadOf "https://$REPO.git"
fi

####################################################################
# Step 3: Enable Clone the repo
####################################################################
git clone -q --depth=1 "https://$REPO.git" repo
cd repo

####################################################################
# Step 4: Checkout the GIT_REF
####################################################################
git fetch origin "$GIT_REF"
git checkout "$GIT_REF"

####################################################################
# Step 5: Initialize LFS
####################################################################
git lfs install --local
git lfs pull
