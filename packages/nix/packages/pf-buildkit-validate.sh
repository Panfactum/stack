#!/usr/bin/env bash

# Validates that buildkit commands can be run and provides
# common variables to be used in buildkit scripts

set -eo pipefail

BUILDKIT_STATEFULSET_NAME_PREFIX="buildkit-"
BUILDKIT_LAST_BUILD_ANNOTATION_KEY="panfactum.com/last-build"
BUILDKIT_NAMESPACE="buildkit"
