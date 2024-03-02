#!/usr/bin/env bash

set -eo pipefail

TAG=$1

podman push "487780594448.dkr.ecr.us-east-2.amazonaws.com/public-app:$TAG"
