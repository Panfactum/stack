#!/usr/bin/env bash

set -eo pipefail

# This script is meant to be used in our CI runners to release
# the terraform locks that they might be holding in the event that they
# are terminated before they can release the locks themselves


####################################################################
# Step 1: Variable parsing
####################################################################
LOCK_TABLE=
AWS_PROFILE=
AWS_REGION=
WHO=

# Define the function to display the usage
usage() {
  echo "Usage: pf-tf-delete-locks -t <lock-table> -p <aws-profile> -r <aws-region> -w <who>" >&2
  echo "       pf-tf-delete-locks --table <lock-table> --profile <aws-profile> --region <aws-region> --who <who>" >&2
  echo "" >&2
  echo "<lock-table>:   The lock table to query" >&2
  echo "<aws-profile>:  The AWS profile to use" >&2
  echo "<aws-region>:   The AWS region to use" >&2
  echo "<who>:          The owner of the locks to release (HOSTNAME of the terragrunt runner)" >&2
  exit 1
}

# Parse command line arguments
TEMP=$(getopt -o t:p:r:w: --long profile:,region:,table:,who:, -- "$@")

# shellcheck disable=SC2181
if [[ $? != 0 ]]; then
  echo "Failed parsing options." >&2
  exit 1
fi

# Note the quotes around `$TEMP`: they are essential!
eval set -- "$TEMP"

# Extract options and their arguments into variables
while true; do
  case "$1" in
  -t | --table)
    LOCK_TABLE="$2"
    shift 2
    ;;
  -p | --profile)
    AWS_PROFILE="$2"
    shift 2
    ;;
  -r | --region)
    AWS_REGION="$2"
    shift 2
    ;;
  -w | --who)
    WHO="$2"
    shift 2
    ;;
  --)
    shift
    break
    ;;
  *)
    usage
    ;;
  esac
done

if [[ -z $LOCK_TABLE ]]; then
  echo "--table is a required argument." >&2
  exit 1
fi

if [[ -z $AWS_PROFILE ]]; then
  echo "--profile is a required argument." >&2
  exit 1
fi

if [[ -z $AWS_REGION ]]; then
  echo "--region is a required argument." >&2
  exit 1
fi

if [[ -z $WHO ]]; then
  echo "--who is a required argument." >&2
  exit 1
fi

####################################################################
# Step 2: Get the Locks
####################################################################

ITEMS=$(aws \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  dynamodb scan \
  --table-name "$LOCK_TABLE" \
  --scan-filter '{"Info": {"ComparisonOperator": "NOT_NULL"}}' \
  --output=json \
  | jq -c '.Items[] | select( if .Info.S then (.Info.S | fromjson).Who == "'"$WHO"'" else false end )'
)

####################################################################
# Step 3: Unlock
####################################################################

echo "$ITEMS" | jq -c ".LockID.S" | while read -r id; do
  echo "Deleting item with LockID: $id"

  # Delete item by Id
  aws \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    dynamodb delete-item \
    --table-name "$TF_LOCK_TABLE" \
    --key "{\"LockID\": {\"S\": $id}}"
done
