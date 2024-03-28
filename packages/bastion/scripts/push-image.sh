#!/usr/bin/env bash

set -eo pipefail

TAG=$1

podman push "ghcr.io/panfactum/bastion:$TAG"
