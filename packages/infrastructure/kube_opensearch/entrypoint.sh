#!/usr/bin/env bash

set -euo pipefail
./bin/opensearch-plugin install -b repository-s3

# This bullshit is required b/c of https://github.com/opensearch-project/OpenSearch/issues/7982
ln -s "$AWS_WEB_IDENTITY_TOKEN_FILE" "${OPENSEARCH_PATH_CONF}/aws-web-identity-token-file"
export AWS_WEB_IDENTITY_TOKEN_FILE="${OPENSEARCH_PATH_CONF}/aws-web-identity-token-file"

./bin/opensearch \
  -Enode.name="$POD_NAME"
