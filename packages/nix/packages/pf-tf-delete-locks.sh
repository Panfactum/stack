#!/usr/bin/env bash

set -eo pipefail

####################################################################
# Step 1: Variable parsing
####################################################################
LOCK_TABLE=
AWS_PROFILE=
AWS_REGION=
WHO=

usage() {
  echo "Releases all Tofu state locks in the indicated lock table that are held by the indicated user" >&2
  echo "" >&2
  echo "Usage: pf-tf-delete-locks [-p <aws-profile>] [-t <lock-table>] [-r <aws-region>] [-w <who>]" >&2
  echo "       pf-tf-delete-locks [--profile <aws-profile>] [--table <lock-table>]  [--region <aws-region>] [--who <who>]" >&2
  echo "" >&2
  echo "<aws-profile>:  (Optional) The AWS profile to use to release the locks."
  echo "                Defaults to the 'tf_state_profile' from pf-get-terragrunt-variables." >&2
  echo "<lock-table>:   (Optional) The DynamoDB table used to hold the Tofu state locks" >&2
  echo "                Defaults to the 'tf_state_lock_table' from pf-get-terragrunt-variables." >&2
  echo "<aws-region>:   (Optional)The AWS region to where the lock table is located" >&2
  echo "                Defaults to the 'tf_state_region' from pf-get-terragrunt-variables." >&2
  echo "<who>:          (Optional) The owner of the locks to release." >&2
  echo "                Defaults to '\$(whoami)@\$(hostname)'" >&2
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

TG_VARS=$(pf-get-terragrunt-variables)

if [[ -z $LOCK_TABLE ]]; then
  LOCK_TABLE=$(echo "$TG_VARS" | jq -r .tf_state_lock_table)
  if [[ $LOCK_TABLE == "null" ]]; then
    echo "Was not able to derive the lock table from the current context. Retry with --table." >&2
    exit 1
  fi
fi

if [[ -z $AWS_PROFILE ]]; then
  AWS_PROFILE=$(echo "$TG_VARS" | jq -r .tf_state_profile)
  if [[ $AWS_PROFILE == "null" ]]; then
    echo "Was not able to derive the AWS profile to use from the current context. Retry with --profile." >&2
    exit 1
  fi
fi

if [[ -z $AWS_REGION ]]; then
  AWS_REGION=$(echo "$TG_VARS" | jq -r .tf_state_region)
  if [[ $AWS_REGION == "null" ]]; then
    echo "Was not able to derive the region of the lock table from the current context. Retry with --region." >&2
    exit 1
  fi
fi

if [[ -z $WHO ]]; then
  WHO="$(whoami)@$(hostname)"
fi

echo "Releasing locks held by $WHO from $LOCK_TABLE in $AWS_REGION using the $AWS_PROFILE AWS profile..." >&2

####################################################################
# Step 2: Get the Locks
####################################################################

ITEMS=$(
  aws \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    dynamodb scan \
    --table-name "$LOCK_TABLE" \
    --scan-filter '{"Info": {"ComparisonOperator": "NOT_NULL"}}' \
    --output=json |
    jq -c '.Items[] | select( if .Info.S then (.Info.S | fromjson).Who == "'"$WHO"'" else false end )'
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
    --table-name "$LOCK_TABLE" \
    --key "{\"LockID\": {\"S\": $id}}"
done
