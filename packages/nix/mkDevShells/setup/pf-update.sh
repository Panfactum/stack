#!/usr/bin/env bash

set -eo pipefail

# Purpose: Runs all the update scripts

export PF_SKIP_CHECK_REPO_SETUP=1

pf-update-aws
echo -e "-----------------------------------------------------------\n" >&2
pf-update-kube
echo -e "-----------------------------------------------------------\n" >&2
pf-update-ssh
echo -e "-----------------------------------------------------------\n" >&2
pf-update-terragrunt
echo -e "-----------------------------------------------------------\n" >&2
pf-update-gitignore
echo -e "-----------------------------------------------------------\n" >&2
pf-update-envrc
echo -e "-----------------------------------------------------------\n" >&2

pf-check-repo-setup
