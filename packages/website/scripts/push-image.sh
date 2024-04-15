#!/usr/bin/env bash

set -eo pipefail

TAG=$1

podman push "891377197483.dkr.ecr.us-east-2.amazonaws.com/website:$TAG"
