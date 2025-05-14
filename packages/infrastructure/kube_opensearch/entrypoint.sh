#!/usr/bin/env bash

set -euo pipefail
./bin/opensearch-plugin install -b repository-s3

# This bullshit is required b/c of https://github.com/opensearch-project/OpenSearch/issues/7982
# Additionally, we switched to static creds b/c of https://github.com/opensearch-project/OpenSearch/issues/16523
#ln -s "$AWS_WEB_IDENTITY_TOKEN_FILE" "${OPENSEARCH_PATH_CONF}/aws-web-identity-token-file"
#export AWS_WEB_IDENTITY_TOKEN_FILE="${OPENSEARCH_PATH_CONF}/aws-web-identity-token-file"

echo "$AWS_ACCESS_KEY_ID" | ./bin/opensearch-keystore add --stdin --force s3.client.default.access_key
echo "$AWS_SECRET_ACCESS_KEY" | ./bin/opensearch-keystore add --stdin --force s3.client.default.secret_key

# Set JVM heap size dynamically to 50% of container memory request
HEAP_SIZE=$((CONTAINER_MEMORY_REQUEST / 2000000))
export OPENSEACH_JAVA_OPTS="-Xmx${HEAP_SIZE}M -Xms${HEAP_SIZE}M --enable-native-access=ALL-UNNAMED"

./bin/opensearch \
  -Enode.name="$POD_NAME" \
  -Eplugins.query.datasources.encryption.masterkey="$OPENSEARCH_MASTER_KEY"
