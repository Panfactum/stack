#!/usr/bin/env bash

# This script restores the environments EKS cluster nodes and resources to their original state

set -eo pipefail
export AWS_PAGER=""

####################################################################
# Step 1: Select the cluster
####################################################################

get_cluster_tag() {
  local tag_key="$1"

  # Retrieve the tags for the EKS cluster
  local tag_value

  tag_value=$(aws eks describe-cluster --name "$EKS_CLUSTER_NAME" --query "cluster.tags.\"$tag_key\"" --output text)

  if [[ $tag_value != "true" ]]; then
    echo "The cluster's '$tag_key' tag is not set to true. Indicating that the cluster is not suspended." >&2
    return 1
  fi

  return 0
}

select_cluster() {
  EKS_CLUSTER_NAME=$(kubectl config get-contexts -o name | fzf --prompt="Select a Kubernetes cluster: ")
  CONTEXT_ARGS="--context=$EKS_CLUSTER_NAME"

  aws_profile=$(pf-get-aws-profile-for-kube-context "$EKS_CLUSTER_NAME")

  # check that provided profile is the root user
  if [[ ! $(aws sts get-caller-identity --profile "$aws_profile" --no-cli-page --output json | jq -r '.Arn') =~ "root" ]]; then
    echo "Error: Provided profile is not the root user. Ensure that the aws profile set in your './kube/config.user.yaml' is for a root user. Exiting." >&2
    exit 1
  fi

  export AWS_PROFILE=$aws_profile

  if ! get_cluster_tag "panfactum.com/suspended"; then
    echo "Cluster '$EKS_CLUSTER_NAME' is not suspended. Exiting." >&2
    exit 1
  fi
}

set_tag_to_cluster() {
  local tag_key=$1
  local tag_value=$2

  echo "Adding tag '$tag_key=$tag_value' to the EKS cluster '$EKS_CLUSTER_NAME'..." >&2

  if aws eks tag-resource \
    --resource-arn "arn:aws:eks:$(aws configure get region):$(aws sts get-caller-identity --query Account --output text):cluster/$EKS_CLUSTER_NAME" \
    --tags "$tag_key=$tag_value"; then
    echo "Successfully added tag '$tag_key=$tag_value' to the EKS cluster '$EKS_CLUSTER_NAME'." >&2
  else
    echo "Failed to add tag to the EKS cluster '$EKS_CLUSTER_NAME'." >&2
  fi
}

####################################################################
# Step 2: Confirmation
####################################################################

confirm_selection() {
  echo -e "You selected \n" >&2
  echo -e "Cluster: $EKS_CLUSTER_NAME\n" >&2
  read -rp "Enter name of cluster to confirm: " CONFIRM_CLUSTER

  if [[ $EKS_CLUSTER_NAME != "$CONFIRM_CLUSTER" ]]; then
    echo -e "$CONFIRM_CLUSTER does not match $EKS_CLUSTER_NAME Exiting.\n" >&2
    exit 1
  fi
}

scale_asg_nat_nodes_up() {
  local prefix="nat-"
  local min_size=1
  local desired_capacity=1

  # Step 1: Get the Subnet IDs associated with the EKS cluster
  vpc_id=$(aws eks describe-cluster --name "$EKS_CLUSTER_NAME" --query "cluster.resourcesVpcConfig.vpcId" --output text)
  subnet_ids=$(aws eks describe-cluster --name "$EKS_CLUSTER_NAME" --query "cluster.resourcesVpcConfig.subnetIds[]" --output text)

  subnet_ids=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpc_id" --query 'Subnets[*].SubnetId' --output json)
  length=$(echo "$subnet_ids" | jq 'length')

  if [[ $length -eq 0 ]]; then
    echo "Failed to get subnet IDs for the EKS cluster." >&2
    return 1
  fi

  # Step 2: Query ASGs and filter by prefix and subnet IDs
  asgs=$(aws autoscaling describe-auto-scaling-groups --query "AutoScalingGroups[?starts_with(AutoScalingGroupName, '${prefix}')] | [].[AutoScalingGroupName, VPCZoneIdentifier]" --output json)

  echo "$asgs" | jq -c '.[]' | while IFS= read -r item; do
    # Extract the nat and subnet values
    nat=$(echo "$item" | jq -r '.[0]')
    subnet=$(echo "$item" | jq -r '.[1]')

    # Check if the subnet is in the list of subnets
    if echo "$subnet_ids" | jq -e --arg subnet "$subnet" 'index($subnet) | . != null' >/dev/null; then
      if aws autoscaling update-auto-scaling-group --auto-scaling-group-name "$nat" --min-size "$min_size" --desired-capacity "$desired_capacity"; then
        echo "Successfully updated $nat to min-size $min_size and desired-capacity $desired_capacity." >&2
      else
        echo "Failed to update $nat." >&2
      fi
    else
      echo "Subnet $subnet is not in the list. Skipping NAT $nat." >&2
    fi
  done
}

scale_eks_nodegroup_up() {
  # Fetch all node groups for the given EKS cluster
  nodegroups=$(aws eks list-nodegroups --cluster-name "$EKS_CLUSTER_NAME" | jq -r '.nodegroups[]')

  if [[ -z $nodegroups ]]; then
    echo "No node groups found for EKS cluster '$EKS_CLUSTER_NAME'." >&2
    return
  fi

  # Process each node group
  for nodegroup in $nodegroups; do
    # Describe the node group to get its details, including tags and ARN
    nodegroup_info=$(aws eks describe-nodegroup --cluster-name "$EKS_CLUSTER_NAME" --nodegroup-name "$nodegroup")

    # Extract the node group ARN and original values from the tags
    original_min_size=$(echo "$nodegroup_info" | jq -r '.nodegroup.tags["panfactum/original-min-size"]')
    original_desired_capacity=$(echo "$nodegroup_info" | jq -r '.nodegroup.tags["panfactum/original-desired-capacity"]')

    if [[ -z $original_min_size || -z $original_desired_capacity ]]; then
      echo "Failed to retrieve original min-size or desired-capacity tags for node group '$nodegroup'. Skipping." >&2
      continue
    fi

    echo "Restoring node group '$nodegroup' to original min-size: $original_min_size, desired-capacity: $original_desired_capacity" >&2

    # Update the node group with the original values
    if aws eks update-nodegroup-config --cluster-name "$EKS_CLUSTER_NAME" --nodegroup-name "$nodegroup" \
      --scaling-config minSize="$original_min_size",desiredSize="$original_desired_capacity"; then
      echo "Successfully updated node group '$nodegroup' to min-size $original_min_size and desired-capacity $original_desired_capacity." >&2
    else
      echo "Failed to update node group '$nodegroup'." >&2
    fi
  done
}

update_scheduler() {
  local namespace=$1
  local deployment_name=$2
  local scheduler_name=$3

  if kubectl "$CONTEXT_ARGS" patch deployment "$deployment_name" -n "$namespace" --patch "{
           \"spec\": {
             \"template\": {
               \"spec\": {
                 \"schedulerName\": \"$scheduler_name\"
               }
             }
           }
  }"; then
    echo "Successfully updated the scheduler to $scheduler_name for $deployment_name in namespace $namespace." >&2
  else
    echo "Failed to update the scheduler for $deployment_name." >&2
  fi
}

# Function to scale up Karpenter node pools by removing limits
scale_up_node_pools() {
  # Check if the nodepool.karpenter.sh resource exists
  if ! kubectl "$CONTEXT_ARGS" get nodepools.karpenter.sh -n "karpenter" &>/dev/null; then
    echo "No nodepools.karpenter.sh resource found, skipping scaling down karpenter nodes." >&2
    return
  fi

  for nodepool in $(kubectl "$CONTEXT_ARGS" get nodepools.karpenter.sh -n "karpenter" -o jsonpath='{.items[*].metadata.name}'); do
    echo "Scaling up node pool: $nodepool" >&2

    if kubectl "$CONTEXT_ARGS" get nodepool.karpenter.sh "$nodepool" -n "karpenter" -o jsonpath='{.spec.limits}' | grep -q "."; then
      kubectl "$CONTEXT_ARGS" patch nodepool.karpenter.sh "$nodepool" -n "karpenter" --type='json' -p='[{"op": "remove", "path": "/spec/limits"}]'
    else
      echo "spec.limits not found, skipping patch for $nodepool"
    fi
  done
}

clear_pending_pods() {
  echo "Listing all Pending pods..." >&2

  # Get all pods in 'Pending' state across all namespaces
  pending_pods=$(kubectl "$CONTEXT_ARGS" get pods --all-namespaces --field-selector=status.phase=Pending -o json | jq -r '.items[] | "\(.metadata.namespace) \(.metadata.name)"')

  if [[ -z $pending_pods ]]; then
    echo "No Pending pods found." >&2
  else
    echo "Found Pending pods, starting deletion process..." >&2

    # Loop through each pending pod and delete it
    while read -r namespace pod_name; do
      echo "Deleting pod: $pod_name in namespace: $namespace" >&2
      kubectl "$CONTEXT_ARGS" delete pod "$pod_name" -n "$namespace"
    done <<<"$pending_pods"

    echo "All Pending pods have been deleted." >&2
  fi
}

wait_for_panfactum_scheduler_pod() {
  local namespace="scheduler"
  local deployment_name="scheduler"

  echo "Waiting for the scheduler pod to be scheduled and running in namespace $namespace..." >&2

  # Timeout after 5 minutes (300 seconds)
  timeout=300
  interval=10
  elapsed=0

  while [[ $elapsed -lt $timeout ]]; do
    pod_status=$(kubectl "$CONTEXT_ARGS" get pod -n "$namespace" -l panfactum.com/workload=scheduler -o jsonpath='{.items[0].status.phase}' 2>/dev/null)

    if [[ $pod_status == "Running" ]]; then
      echo "$deployment_name pod is running." >&2
      return 0
    else
      echo "Pod status: $pod_status. Waiting..." >&2
    fi

    sleep $interval
    elapsed=$((elapsed + interval))
  done

  echo "Timed out waiting for $deployment_name pod to be scheduled." >&2
  return 1
}

restore_scheduler() {
  local namespace="scheduler"
  local deployment_name="scheduler"

  deployment_exists=$(kubectl get deployments -n "$namespace" -o jsonpath="{.items[?(@.metadata.name=='$deployment_name')].metadata.name}")
  if [[ $deployment_exists == "$deployment_name" ]]; then
    echo "Deployment 'scheduler' found. Performing actions..." >&2

    # Perform actions
    wait_for_panfactum_scheduler_pod
    update_scheduler "cilium" "cilium-operator" "panfactum"

  else
    echo "Deployment 'scheduler' not found." >&2
  fi
}

resume() {
  # select the cluster
  select_cluster

  # confirm the selection
  confirm_selection

  # Scale up 'nat-' ASGs to 1
  scale_asg_nat_nodes_up

  # update the cilium operator deployment to use the `default-scheduler`
  update_scheduler "cilium" "cilium-operator" "default-scheduler"

  # clear pending pods
  clear_pending_pods

  # Scale up EKS node groups
  scale_eks_nodegroup_up

  # Scale up Karpenter node pools
  scale_up_node_pools

  restore_scheduler

  set_tag_to_cluster "panfactum.com/suspended" "false"
}

resume
