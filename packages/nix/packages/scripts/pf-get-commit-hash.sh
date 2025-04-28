#!/usr/bin/env bash

set -eo pipefail

# This script is intended to support
# getting the git commit sha for a given version in our IaC paradigm.
# This is used to tag infrastructure and to reference build artifacts
# which are stored via commit shas

####################################################################
# Step 1: Variable parsing
####################################################################
GIT_REPO="origin"
GIT_REF=""
NO_VERIFY=0

usage() {
  echo "Usage: pf-get-commit-hash [-r <git_repo>] [-c <git_ref>] [-n]" >&2
  echo "       pf-get-commit-hash [--repo <git_repo>] [--ref <git_ref>] [--no-verify]" >&2
  echo "" >&2
  echo "<git_repo>: The git repo for which the git_ref will be resolved. If not specified, will use the current, local git repo." >&2
  echo "" >&2
  echo "<git_ref>: The git ref to resolve into a commit hash. May be any valid ref: a commit hash, a branch name, or a tag." >&2
  echo "            Additionally, may specify 'local' to simply return local and skip the resolution." >&2
  echo "" >&2
  echo "--no-verify: Will not verify the commit hash is valid by checking out the repo locally." >&2
  exit 1
}

# Parse command line arguments
TEMP=$(getopt -o r:c:n --long repo:,ref:,no-verify -- "$@")

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
    GIT_REPO="$2"
    shift 2
    ;;
  -c | --ref)
    GIT_REF="$2"
    shift 2
    ;;
  -n | --no-verify)
    NO_VERIFY=1
    shift 1
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

# If the git ref is local, then this isn't pinned to a particular commit
# so just return "local"
if [[ $GIT_REF == "local" ]]; then
  echo "local"
  exit 0
elif [[ -z $GIT_REF ]]; then

  # If not git_ref or git_repo is presented, simply return the commit hash of HEAD
  if [[ $GIT_REPO == "origin" ]]; then
    git rev-parse HEAD
    exit 0
  else
    echo "Error: You cannot specify an empty git_ref and also specify a git_repo. Too ambiguous to resolve the hash." >&2
    exit 1
  fi

# If the ref is a commit hash already, we check to see if it is a valid hash
elif [[ $GIT_REF =~ ^[0-9a-f]{40}$ ]]; then
  if [[ $NO_VERIFY != 1 ]]; then
    if [[ $GIT_REPO == "origin" ]]; then
      if git fetch origin "$GIT_REF" 2>/dev/null; then
        echo "$GIT_REF"
        exit 0
      else
        echo "Error: commit $GIT_REF does not exist in the remote origin" >&2
        exit 1
      fi
    else
      TEMP_DIR=$(mktemp -d)
      cd "$TEMP_DIR"
      git init -q
      if git fetch "$GIT_REPO" "$GIT_REF" 2>/dev/null; then
        echo "$GIT_REF"
        rm -rf "$TEMP_DIR"
        exit 0
      else
        echo "Error: commit $GIT_REF does not exist in $GIT_REPO" >&2
        rm -rf "$TEMP_DIR"
        exit 1
      fi
    fi
  else
    echo "$GIT_REF"
    exit 0
  fi

# Otherwise, we can simply fetch the hash from the remote
else

  if [[ $GIT_REPO == "origin" ]]; then

    # Check if the repo has no commits
    set +e
    if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
      echo "local"
      exit 0
    fi

    git rev-parse "$GIT_REF"
    exit 0
  else
    git ls-remote --exit-code "$GIT_REPO" "$GIT_REF" | awk '{print $1}'
    exit 0
  fi
fi
