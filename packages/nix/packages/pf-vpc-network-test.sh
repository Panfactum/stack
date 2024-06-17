#!/usr/bin/env bash

# This script is intended to test to ensure connectivity after deploying the aws_vpc modules

set -eo pipefail

####################################################################
# Step 0: Validation
####################################################################

if [[ -z ${PF_AWS_DIR} ]]; then
  echo "Error: PF_AWS_DIR is not set. Add it to your devenv.nix file." >&2
  exit 1
fi

AWS_CONFIG_FILE="$DEVENV_ROOT/$PF_AWS_DIR/config"
if ! [[ -f $AWS_CONFIG_FILE ]]; then
  echo "Error: No AWS config file found at $AWS_CONFIG_FILE." >&2
  exit 1
fi

####################################################################
# Step 1: Variable parsing
####################################################################

# Define the function to display the usage
usage() {
  echo "Usage: pf-vpc-network-test <path-to-aws-vpc-module>" >&2
  echo "       pf-vpc-network-test <path-to-aws-vpc-module>" >&2
  echo "" >&2
  echo "<path-to-aws-vpc-module>: The path to the AWS vpc module" >&2
  exit 1
}

MODULE_PATH_INPUT="$1"

if [[ -z $MODULE_PATH_INPUT ]]; then
  usage
fi

####################################################################
# Step 2: Get aws_vpc module outputs
####################################################################

MODULE_PATH="$(realpath "$(pwd)/$MODULE_PATH_INPUT")"

if [[ ! -d $MODULE_PATH ]]; then
  echo "Error: No module at $MODULE_PATH!" >&2
  exit 1
fi

echo "Retrieving test configuration from $MODULE_PATH..." >&2
TEST_CONFIG="$(terragrunt output --json --terragrunt-working-dir="$MODULE_PATH" | jq -r '.test_config.value')"
echo -e "Done.\n" >&2

AWS_REGION="$(echo "$TEST_CONFIG" | jq -r '.region')"

####################################################################
# Step 3: Select AWS profile to use to run the test
####################################################################

# Extracts the available AWS profiles from the config file
AVAILABLE_AWS_PROFILES=$(grep -oP '(?<=\[profile ).*?(?=\])' "$AWS_CONFIG_FILE")

# Select the aws profile to use for the environment
AWS_PROFILE=$(echo "$AVAILABLE_AWS_PROFILES" | fzf --prompt="Select AWS profile for test: ")
if [[ -z $AWS_PROFILE ]]; then
  echo -e "No profile selected.. Exiting.\n" >&2
  exit 1
fi

####################################################################
# Step 4: Run the tests
####################################################################

# Scale an autoscaling group
scale_asg() {
  local asg_name=$1
  local desired_capacity=$2
  aws --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    autoscaling update-auto-scaling-group \
    --auto-scaling-group-name "$asg_name" \
    --desired-capacity "$desired_capacity"
}

# Get the instance ID of an instance in an autoscaling group
get_instance_id() {
  local instance_id=
  while [[ -z $instance_id ]] || [[ $instance_id == "None" ]] || [[ $instance_id == "" ]]; do
    echo -e "\tWaiting for instance to be created..." >&2
    sleep 10
    instance_id="$(
      aws \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        autoscaling describe-auto-scaling-groups \
        --auto-scaling-group-names "$1" \
        --query "AutoScalingGroups[0].Instances[0].InstanceId" \
        --output text
    )"
  done

  echo "$instance_id"
}

# Get the public IP of an instance using aws ssm and running curl
run_ssm_command() {
  local instance_id=$1
  local command_id=""
  local retries=10

  for ((i = 1; i <= retries; i++)); do
    set +eo pipefail
    command_id="$(
      aws --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        ssm send-command \
        --instance-ids "$instance_id" \
        --document-name "AWS-RunShellScript" \
        --comment "Get Public IP" \
        --parameters commands="curl -m 10 ifconfig.me" \
        --query "Command.CommandId" \
        --output text 2>/dev/null
    )"
    set -eo pipefail

    if [[ -n $command_id ]]; then
      echo "$command_id"
      exit 0
    fi
    sleep 5
  done

  echo -e "\tFailed to execute test!"
  exit 1
}

# Gets the result of an ssm command
get_ssm_command_output() {
  local instance_id=$1
  local command_id=$2
  local status=""
  while true; do
    status="$(
      aws --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        ssm get-command-invocation \
        --instance-id "$instance_id" \
        --command-id "$command_id" \
        --query "Status" \
        --output text
    )"
    if [[ $status == "Success" || $status == "Failed" ]]; then
      break
    fi
    sleep 5
  done

  if [[ $status == "Failed" ]]; then
    error="$(
      aws --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        ssm get-command-invocation \
        --instance-id "$instance_id" \
        --command-id "$command_id" \
        --query "StandardErrorContent" \
        --output text
    )"
    echo -e "\tTest failed: $error\n" >&2
    exit 1
  fi

  aws --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    ssm get-command-invocation \
    --instance-id "$instance_id" \
    --command-id "$command_id" \
    --query "StandardOutputContent" \
    --output text
}

# Get the number of subnets to test
SUBNETS=$(echo "$TEST_CONFIG" | jq -r '.subnets')
NUMBER_OF_SUBNETS=$(echo "$SUBNETS" | jq -r 'length')

# Install an exit trap to ensure that however the script
# exits, all ASGs are scaled down
scale_down_all_asgs() {
  for ((i = 0; i < NUMBER_OF_SUBNETS; i++)); do
    ASG=$(echo "$SUBNETS" | jq -r ".[$i].asg")
    scale_asg "$ASG" 0
  done
}
trap scale_down_all_asgs EXIT

# Run the tests sequentially for all subnets
for ((i = 0; i < NUMBER_OF_SUBNETS; i++)); do

  SUBNET=$(echo "$SUBNETS" | jq -r ".[$i].subnet")
  ASG=$(echo "$SUBNETS" | jq -r ".[$i].asg")
  NAT_IP=$(echo "$SUBNETS" | jq -r ".[$i].nat_ip")

  echo -e "Running test for subnet: $SUBNET\n" >&2

  # Step 1: Create a test instance
  echo -e "\tScaling ASG $ASG to 1..." >&2
  scale_asg "$ASG" 1

  # Step 2: Get the instance id
  INSTANCE_ID="$(get_instance_id "$ASG")"
  echo -e "\tInstance ID: $INSTANCE_ID\n" >&2

  # Step 3: Run the network test
  echo -e "\tExecuting network test on $INSTANCE_ID..." >&2
  COMMAND_ID="$(run_ssm_command "$INSTANCE_ID")"

  # Step 4: Get the result of the network test
  PUBLIC_IP="$(get_ssm_command_output "$INSTANCE_ID" "$COMMAND_ID")"
  echo -e "\tPublic IP for instance $INSTANCE_ID: $PUBLIC_IP\n"

  # Step 5: Ensure the public IP is correct
  if ! [[ $NAT_IP == "$PUBLIC_IP" ]]; then
    echo -e "\t$INSTANCE_ID is NOT connecting through NAT!" >&2
    exit 1
  fi

  # Step 6: Ensure that the NAT_IP rejects inbound traffic
  if ping -q -w 3 -c 1 "$NAT_IP" >/dev/null 2>&1; then
    echo -e "\tNetwork traffic not blocked to $NAT_IP!" >&2
    exit 1
  fi

  echo -e "\tTest completed successfully for $SUBNET." >&2

  echo -e "-----------------------------------------------------\n" >&2
done
