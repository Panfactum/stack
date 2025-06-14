#!/usr/bin/env bash

set -eo pipefail

if [[ -n $GIT_USERNAME ]] && [[ -z $GIT_PASSWORD ]]; then
  echo "If GIT_USERNAME is supplied, a GIT_PASSWORD must also be supplied." >&2
  exit 1
fi

if [[ -n $GIT_USERNAME ]]; then
  REPO="https://$GIT_USERNAME:$GIT_PASSWORD@$CODE_REPO"
else
  REPO="https://$CODE_REPO"
fi

COMMIT_HASH=$(pf util get-commit-hash --repo "$REPO" --ref "$GIT_REF" --no-verify)
echo "$COMMIT_HASH" >/tmp/commit-hash

TAG="${IMAGE_TAG_PREFIX:+$IMAGE_TAG_PREFIX-}$COMMIT_HASH"
echo "$TAG" >/tmp/tag

if aws ecr describe-images --repository-name "$IMAGE_REPO" --image-ids imageTag="$TAG" --region "$IMAGE_REGION" >/dev/null 2>&1; then
  touch /tmp/exists
fi
