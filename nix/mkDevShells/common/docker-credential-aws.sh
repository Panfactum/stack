#!/usr/bin/env bash

# Implements this spec: https://github.com/docker/docker-credential-helpers
# in order to aid in ECR login

set -eo pipefail

COMMAND="${1:-get}"
REGISTRY="$(</dev/stdin)"

function output() {
  echo "{\"Username\": \"AWS\", \"Secret\": \"$1\"}"
}

case "$REGISTRY" in
487780594448.dkr.ecr.us-east-2.amazonaws.com)
  AWS_PROFILE=operations-superuser
  REGION=us-east-2
  ;;
938942960544.dkr.ecr.us-east-2.amazonaws.com)
  AWS_PROFILE=development-superuser
  REGION=us-east-2
  ;;
*)
  echo >&2 "Unknown registry provided: $REGISTRY"
  exit 1
  ;;
esac

if [[ $COMMAND == "get" ]]; then
  PASSWORD="$(aws --profile "$AWS_PROFILE" --region "$REGION" ecr get-login-password)"
  output "$PASSWORD"
fi
