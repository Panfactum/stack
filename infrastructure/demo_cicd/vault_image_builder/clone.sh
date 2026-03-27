#!/usr/bin/env bash

set -eo pipefail

cd /code || exit
git clone https://github.com/Panfactum/stack.git --depth=1
cd stack || exit
git fetch origin "$GIT_REF"
git checkout "$GIT_REF"
