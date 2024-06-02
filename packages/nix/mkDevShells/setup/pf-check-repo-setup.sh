#!/usr/bin/env bash

# Purpose: There are many setup steps that are required to ensure that users of the Panfactum stack have
# a smooth experience. This utility function should be run every time the devenv gets launched in order
# to ensure that the setup steps have been completed properly.

# Aggregate all of the error messages here and print them all at the end
errors=""

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
## Check Repo Metadata
#################################################

if [[ -z ${PF_REPO_NAME} ]]; then
  errors+="\033[33mEnvironment variable PF_REPO_NAME is not set. Add it to your devenv.nix file.\033[0m\n\n"
fi

if [[ -z ${PF_REPO_URL} ]]; then
  errors+="\033[33mEnvironment variable PF_REPO_URL is not set. Add it to your devenv.nix file.\033[0m\n\n"
elif ! [[ ${PF_REPO_URL} =~ ^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}.*$ ]]; then
  errors+="\033[33mEnvironment variable PF_REPO_URL is not of the proper format. Ensure it does NOT include a protocol prefix such as 'https://'. A correct example would look like 'github.com/user/repo'.\033[0m\n\n"
fi

if [[ -z ${PF_REPO_PRIMARY_BRANCH} ]]; then
  errors+="\033[33mEnvironment variable PF_REPO_PRIMARY_BRANCH is not set. Add it to your devenv.nix file.\033[0m\n\n"
fi

#################################################
## Check Top-level .gitignore setup
#################################################

function isIgnored() {
  git check-ignore "$DEVENV_ROOT/$1" >/dev/null
}

if ! isIgnored ".env" || ! isIgnored ".terragrunt-cache" || ! isIgnored ".terraform" || ! isIgnored ".devenv" || ! isIgnored ".direnv"; then
  errors+="\033[33m.gitignore file is missing files/directories that should not be committed. Run pf-update-gitignore to update.\033[0m\n\n"
fi

#################################################
## Check envrc setup
#################################################

if ! cmp -s "$(realpath "$DEVENV_ROOT/.envrc")" "$files_dir"/files/direnv/envrc; then
  errors+="\033[33m.envrc file is out of date. Run pf-update-envrc to update.\033[0m\n\n"
fi

#################################################
## Check terragrunt setup
#################################################

if [[ -z ${PF_ENVIRONMENTS_DIR} ]]; then
  errors+="\033[33mEnvironment variable PF_ENVIRONMENTS_DIR is not set. Add it to your devenv.nix file.\033[0m\n\n"
elif ! dirs_are_equal "$files_dir"/files/terragrunt "$(realpath "$DEVENV_ROOT/$PF_ENVIRONMENTS_DIR")"; then
  errors+="\033[33mTerragrunt files are out of date. Run pf-update-terragrunt to update.\033[0m\n\n"
fi

if [[ -z ${PF_IAC_DIR} ]]; then
  errors+="\033[33mEnvironment variable PF_IAC_DIR is not set. Add it to your devenv.nix file.\033[0m\n\n"
fi

#################################################
## Check ssh setup
#################################################

if [[ -z ${PF_SSH_DIR} ]]; then
  errors+="\033[33mEnvironment variable PF_SSH_DIR is not set. Add it to your devenv.nix file.\033[0m\n\n"
elif ! dirs_are_equal "$files_dir"/files/ssh "$(realpath "$DEVENV_ROOT/$PF_SSH_DIR")"; then
  errors+="\033[33mSSH files are out of date. Run pf-update-ssh to update.\033[0m\n\n"
elif [[ "$(pf-get-ssh-state-hash)" != "$(cat "$DEVENV_ROOT/$PF_SSH_DIR/state.lock")" ]]; then
  errors+="\033[33mGenerated SSH config files is out of date. A superuser must run 'pf-update-ssh --build' to update.\033[0m\n\n"
fi

#################################################
## Check kube setup
#################################################

if [[ -z ${PF_KUBE_DIR} ]]; then
  errors+="\033[33mEnvironment variable PF_KUBE_DIR is not set. Add it to your devenv.nix file.\033[0m\n\n"
elif ! dirs_are_equal "$files_dir"/files/kube "$(realpath "$DEVENV_ROOT/$PF_KUBE_DIR")"; then
  errors+="\033[33mKubernetes config files are out of date. Run pf-update-kube to update.\033[0m\n\n"
elif [[ "$(pf-get-kube-state-hash)" != "$(cat "$DEVENV_ROOT/$PF_KUBE_DIR/state.lock")" ]]; then
  errors+="\033[33mKubernetes config files are out of date. A superuser must run 'pf-update-kube --build' to update.\033[0m\n\n"
elif [[ "$(pf-get-kube-user-state-hash)" != "$(cat "$DEVENV_ROOT/$PF_KUBE_DIR/state.user.lock")" ]]; then
  errors+="\033[33mkubeconfig is out of date. Run pf-update-kube to update.\033[0m\n\n"
fi

#################################################
## Check AWS setup
#################################################

if [[ -z ${PF_AWS_DIR} ]]; then
  errors+="\033[33mEnvironment variable PF_AWS_DIR is not set. Add it to your devenv.nix file.\033[0m\n\n"
elif ! dirs_are_equal "$files_dir"/files/aws "$(realpath "$DEVENV_ROOT/$PF_AWS_DIR")"; then
  errors+="\033[33mAWS config files are out of date. Run pf-update-aws to update.\033[0m\n\n"
elif [[ "$(pf-get-aws-state-hash)" != "$(cat "$DEVENV_ROOT/$PF_AWS_DIR/state.lock")" ]]; then
  errors+="\033[33mGenerated AWS config files is out of date. A superuser must run 'pf-update-aws --build' to update.\033[0m\n\n"
fi

#################################################
## Print Error Messages
#################################################

if [[ -n $errors ]]; then
  echo -e "\033[33mIssues detected with your repository setup:\033[0m\n" >&2
  echo -e "$errors" >&2
fi
