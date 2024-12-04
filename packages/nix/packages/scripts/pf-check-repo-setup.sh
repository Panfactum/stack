#!/usr/bin/env bash

# Purpose: There are many setup steps that are required to ensure that users of the Panfactum stack have
# a smooth experience. This utility function should be run every time the devenv gets launched in order
# to ensure that the setup steps have been completed properly.

# Aggregate all of the error messages here and print them all at the end
errors=""
has_build_required_error=0

# Utility for comparing if a destination directory contains exact copies of the
# files in the source directory (relative locations are expected to be the same)
function dirs_are_equal() {
  source_dir=$1
  destination_dir=$2
  while IFS= read -r src_file; do
    # Generate the corresponding destination file path
    dest_file="${destination_dir}${src_file#"$source_dir"}"

    # Compare the source file with the destination file
    if ! cmp -s "$src_file" "$dest_file"; then
      return 1
    fi
  done < <(find "$source_dir" -type f)
  return 0
}

files_dir="$(dirname "$(dirname "$(realpath "$0")")")"

#################################################
## Get Repo Variables
#################################################
if ! REPO_VARIABLES=$(pf-get-repo-variables); then
  echo -e "\033[33mError: You must create a repo configuration variables file at panfactum.yaml to use the devenv! See https://panfactum.com/docs/edge/reference/configuration/repo-variables.\033[0m\n" >&2
  exit 1
fi
REPO_ROOT=$(echo "$REPO_VARIABLES" | jq -r '.repo_root')

#################################################
## Check Top-level .gitignore setup
#################################################

function isIgnored() {
  git check-ignore "$REPO_ROOT/$1" >/dev/null
}

if ! isIgnored ".env" || ! isIgnored ".terragrunt-cache" || ! isIgnored ".terraform" || ! isIgnored ".devenv" || ! isIgnored ".direnv" || ! isIgnored ".nats"; then
  errors+="\033[33m.gitignore file is missing files/directories that should not be committed. Run pf-update-gitignore to update.\033[0m\n\n"
fi

#################################################
## Check envrc setup
#################################################

if ! cmp -s "$(realpath "$REPO_ROOT/.envrc")" "$files_dir"/files/direnv/envrc; then
  errors+="\033[33m.envrc file is out of date. Run pf-update-envrc to update.\033[0m\n\n"
fi

#################################################
## Check terragrunt setup
#################################################

ENVIRONMENTS_DIR=$(echo "$REPO_VARIABLES" | jq -r '.environments_dir')

if ! dirs_are_equal "$files_dir"/files/terragrunt "$ENVIRONMENTS_DIR"; then
  errors+="\033[33mTerragrunt files are out of date. Run pf-update-terragrunt to update.\033[0m\n\n"
fi

#################################################
## Check ssh setup
#################################################

SSH_DIR=$(echo "$REPO_VARIABLES" | jq -r '.ssh_dir')

if ! dirs_are_equal "$files_dir"/files/ssh "$SSH_DIR"; then
  errors+="\033[33mSSH files are out of date. Run pf-update-ssh to update.\033[0m\n\n"
elif [[ "$(pf-get-ssh-state-hash)" != "$(cat "$SSH_DIR/state.lock")" ]]; then
  if [[ -f "$SSH_DIR/config.yaml" ]]; then
    has_build_required_error=1
    errors+="\033[33mGenerated SSH config files are out of date. A superuser must run 'pf-update-ssh --build' to update.\033[0m\n\n"
  else
    errors+="\033[33mSSH files are out of date. Run pf-update-ssh to update.\033[0m\n\n"
  fi
fi

#################################################
## Check kube setup
#################################################

KUBE_DIR=$(echo "$REPO_VARIABLES" | jq -r '.kube_dir')

if ! dirs_are_equal "$files_dir"/files/kube "$KUBE_DIR"; then
  errors+="\033[33mKubernetes config files are out of date. Run pf-update-kube to update.\033[0m\n\n"
elif [[ "$(pf-get-kube-state-hash)" != "$(cat "$KUBE_DIR/state.lock")" ]]; then
  if [[ -f "$KUBE_DIR/config.yaml" ]]; then
    has_build_required_error=1
    errors+="\033[33mKubernetes config files are out of date. A superuser must run 'pf-update-kube --build' to update.\033[0m\n\n"
  else
    errors+="\033[33mkubeconfig is out of date. Run pf-update-kube to update.\033[0m\n\n"
  fi
elif [[ "$(pf-get-kube-user-state-hash)" != "$(cat "$KUBE_DIR/state.user.lock")" ]]; then
  errors+="\033[33mkubeconfig is out of date. Run pf-update-kube to update.\033[0m\n\n"
fi

#################################################
## Check AWS setup
#################################################

AWS_DIR=$(echo "$REPO_VARIABLES" | jq -r '.aws_dir')

if ! dirs_are_equal "$files_dir"/files/aws "$AWS_DIR"; then
  errors+="\033[33mAWS config files are out of date. Run 'pf-update-aws' to update.\033[0m\n\n"
elif [[ "$(pf-get-aws-state-hash)" != "$(cat "$AWS_DIR/state.lock")" ]]; then
  if [[ -f "$AWS_DIR/config.yaml" ]]; then
    has_build_required_error=1
    errors+="\033[33mGenerated AWS config files are out of date. A superuser must run 'pf-update-aws --build' to update.\033[0m\n\n"
  else
    errors+="\033[33mAWS config files are out of date. Run 'pf-update-aws' to update.\033[0m\n\n"
  fi
fi

#################################################
## Check BuildKit setup
#################################################

BUILDKIT_DIR=$(echo "$REPO_VARIABLES" | jq -r '.buildkit_dir')

if ! dirs_are_equal "$files_dir"/files/buildkit "$BUILDKIT_DIR"; then
  errors+="\033[33mBuildKit config files are out of date. Run 'pf-update-buildkit' to update.\033[0m\n\n"
elif [[ "$(pf-get-buildkit-state-hash)" != "$(cat "$BUILDKIT_DIR/state.lock")" ]]; then
  if [[ -f "$BUILDKIT_DIR/config.yaml" ]]; then
    has_build_required_error=1
    errors+="\033[33mGenerated BuildKit config files are out of date. A superuser must run 'pf-update-buildkit --build' to update.\033[0m\n\n"
  else
    errors+="\033[33mBuildKit config files are out of date. Run 'pf-update-buildkit' to update.\033[0m\n\n"
  fi
elif [[ "$(pf-get-buildkit-user-state-hash)" != "$(cat "$BUILDKIT_DIR/state.user.lock")" ]]; then
  errors+="\033[33mBuildKit config is out of date. Run pf-update-buildkit to update.\033[0m\n\n"
fi

#################################################
## Print Error Messages
#################################################
if [[ -n $errors && $has_build_required_error == 0 ]]; then
  echo -e "\033[33mYour repository files are out-of-date with the current version of the Panfactum stack.\033[0m\n\n" >&2
  echo -e "\033[33mRun 'pf-update' to updates your files and resolve this warning.\033[0m" >&2
elif [[ -n $errors ]]; then
  echo -e "\033[33mIssues detected with your repository setup:\033[0m\n" >&2
  echo -e "$errors" >&2
fi
