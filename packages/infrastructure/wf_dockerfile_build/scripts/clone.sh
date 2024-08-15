#!/usr/bin/env bash

set -eo pipefail

cd /code
pf-wf-git-checkout \
  -r "$CODE_REPO" \
  -c "$GIT_REF" \
  -u "$GIT_USERNAME" \
  -p "$GIT_PASSWORD"
cd repo
