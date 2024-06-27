#!/usr/bin/env bash

set -eo pipefail

cd /code || exit
git clone --depth=1 https://github.com/topolvm/pvc-autoresizer.git repo
cd repo || exit
git fetch origin "$GIT_REF"
git checkout "$GIT_REF"
git lfs install --local
git lfs pull
