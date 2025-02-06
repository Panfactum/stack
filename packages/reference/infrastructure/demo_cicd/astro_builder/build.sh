#!/usr/bin/env bash

set -eo pipefail

###########################################################
## Step 1: CD to the codebase
###########################################################
cd /code/stack || exit

###########################################################
## Step 2: Get BuildKit address
###########################################################
BUILDKIT_HOST=$(pf-buildkit-get-address --arch=amd64)
export BUILDKIT_HOST

###########################################################
## Step 3: Record the build
###########################################################
pf-buildkit-record-build --arch=amd64

###########################################################
## Step 4: Get AWS credentials for the s3 upload
###########################################################
CREDS=$(aws configure export-credentials)
AWS_ACCESS_KEY_ID=$(echo "$CREDS" | jq -r .AccessKeyId)
AWS_SECRET_ACCESS_KEY=$(echo "$CREDS" | jq -r .SecretAccessKey)
AWS_SESSION_TOKEN=$(echo "$CREDS" | jq -r .SessionToken)
export AWS_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY
export AWS_SESSION_TOKEN

###########################################################
## Step 5: Build the image
###########################################################
buildctl \
  build \
  --frontend=dockerfile.v0 \
  --output "type=image,name=astro-builder:latest,push=false" \
  --local context=. \
  --local dockerfile=./packages/website \
  --opt filename=./Containerfile \
  --secret id=AWS_ACCESS_KEY_ID,env=AWS_ACCESS_KEY_ID \
  --secret id=AWS_SECRET_ACCESS_KEY,env=AWS_SECRET_ACCESS_KEY \
  --secret id=AWS_SESSION_TOKEN,env=AWS_SESSION_TOKEN \
  --opt build-arg:ALGOLIA_APP_ID="$ALGOLIA_APP_ID" \
  --opt build-arg:ALGOLIA_SEARCH_API_KEY="$ALGOLIA_SEARCH_API_KEY" \
  --opt build-arg:ALGOLIA_INDEX_NAME="$ALGOLIA_INDEX_NAME" \
  --opt build-arg:SITE_URL="$SITE_URL" \
  --export-cache "type=s3,region=$BUILDKIT_BUCKET_REGION,bucket=$BUILDKIT_BUCKET_NAME,name=astro-builder" \
  --import-cache "type=s3,region=$BUILDKIT_BUCKET_REGION,bucket=$BUILDKIT_BUCKET_NAME,name=astro-builder"

###########################################################
## Step 6: Invalidate the Cloudfront Cache
###########################################################
aws cloudfront create-invalidation --distribution-id="$DISTRIBUTION_ID" --paths="/*"
