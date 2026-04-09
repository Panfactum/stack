#!/usr/bin/env bash

# Validates that buildkit commands can be run and provides
# common variables to be used in buildkit scripts

set -eo pipefail

# shellcheck disable=SC2034
BUILDKIT_STATEFULSET_NAME_PREFIX="buildkit-"
# shellcheck disable=SC2034
BUILDKIT_LAST_BUILD_ANNOTATION_KEY="panfactum.com/last-build"
# shellcheck disable=SC2034
BUILDKIT_NAMESPACE="buildkit"
