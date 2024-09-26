#!/usr/bin/env bash

# This script suspends by removing the environments EKS cluster nodes and non destructive resources

set -eo pipefail
export AWS_PAGER=""

validate_kube_config() {
  REPO_VARIABLES=$(pf-get-repo-variables)
  KUBE_DIR=$(echo "$REPO_VARIABLES" | jq -r '.kube_dir')
  KUBE_CONFIG_PATH="$KUBE_DIR/config"

  if [[ ! -f $KUBE_CONFIG_PATH ]]; then
    echo "Error: No kubeconfig file found at $KUBE_CONFIG_PATH. Create it with 'pf-update-kube' first!" >&2
    exit 1
  fi
}

select_cluster() {
  EKS_CLUSTER_NAME=$(kubectl config get-contexts -o name | fzf --prompt="Select a Kubernetes cluster: ")
  CONTEXT_ARGS="--context=$EKS_CLUSTER_NAME"

  aws_profile=$(pf-get-aws-profile-for-kube-context "$EKS_CLUSTER_NAME")

  # check that provided profile is the root user
  if [[ ! $(aws sts get-caller-identity --profile "$aws_profile" --no-cli-page --output json | jq -r '.Arn') =~ "root" ]]; then
    echo "Error: Provided profile is not the root user. Exiting." >&2
    exit 1
  fi

  export AWS_PROFILE=$aws_profile
}

confirmation() {
  echo -e "You selected \n" >&2
  echo -e "Cluster: $EKS_CLUSTER_NAME\n" >&2
  echo -e "Profile: $AWS_PROFILE\n" >&2
  echo -e "WARNING: This will suspend core cluster resources.\n" >&2
  read -rp "Enter name of cluster to confirm: " CONFIRM_CLUSTER

  if [[ $EKS_CLUSTER_NAME != "$CONFIRM_CLUSTER" ]]; then
    echo -e "$CONFIRM_CLUSTER does not match $EKS_CLUSTER_NAME Exiting.\n" >&2
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

function limit_karpenter_node_pools() {
  # Check if the nodepool.karpenter.sh resource exists
  if ! kubectl "$CONTEXT_ARGS" get nodepools.karpenter.sh -n "karpenter" &>/dev/null; then
    echo "No nodepools.karpenter.sh resource found, skipping scaling down karpenter nodes." >&2
    return
  fi

  for nodepool in $(kubectl "$CONTEXT_ARGS" get nodepools.karpenter.sh -n "karpenter" -o jsonpath='{.items[*].metadata.name}'); do
    echo "Scaling down node pool: $nodepool" >&2
    kubectl "$CONTEXT_ARGS" patch nodepool.karpenter.sh "$nodepool" -n "karpenter" --type='merge' -p='{
      "spec": {
        "limits": {
          "cpu": "0",
          "memory": "0Gi"
        }
      }
    }'
  done
}

# terminate the controller nodes
function terminate_karpenter_nodes() {
  echo "Fetching Karpenter nodes..."
  karpenter_nodes=$(kubectl "$CONTEXT_ARGS" get nodes -l karpenter.sh/initialized=true -o json | jq -r '.items[] | .metadata.name')

  # Loop through each node and terminate the associated EC2 instance
  for node in $karpenter_nodes; do
    echo "Processing node: $node" >&2

    # Get the providerID for the node
    provider_id=$(kubectl "$CONTEXT_ARGS" get node "$node" -o json | jq -r '.spec.providerID')

    # Extract instance_id from the providerID (format: aws:///us-east-2a/i-00f7cadf689464acd)
    instance_id=$(echo "$provider_id" | awk -F '/' '{print $NF}')

    if [[ -n $instance_id ]]; then
      echo "Found instance ID: $instance_id for node $node" >&2

      # Terminate the EC2 instance
      echo "Terminating EC2 instance $instance_id..." >&2
      aws ec2 terminate-instances --instance-ids "$instance_id"

      # Optionally, wait until the instance is terminated
      echo "Waiting for instance termination..." >&2
      aws ec2 wait instance-terminated --instance-ids "$instance_id" --no-cli-pager

      echo "EC2 instance $instance_id terminated successfully." >&2
    else
      echo "No instance ID found for node $node, skipping..." >&2
    fi
  done
}

scale_eks_nodegroup_down() {
  local min_size=0
  local desired_capacity=0

  # Retrieve all the node groups in the EKS cluster
  nodegroups=$(aws eks list-nodegroups --cluster-name "$EKS_CLUSTER_NAME" | jq -r '.nodegroups[]')

  if [[ -z $nodegroups ]]; then
    echo "No node groups found for EKS cluster '$EKS_CLUSTER_NAME'." >&2
    return
  fi

  # Loop through each node group
  for nodegroup in $nodegroups; do
    echo "Updating node group: $nodegroup" >&2

    # Retrieve the current configuration and ARN of the node group
    nodegroup_info=$(aws eks describe-nodegroup --cluster-name "$EKS_CLUSTER_NAME" --nodegroup-name "$nodegroup")
    nodegroup_arn=$(echo "$nodegroup_info" | jq -r '.nodegroup.nodegroupArn')
    current_config=$(echo "$nodegroup_info" | jq -r '.nodegroup.scalingConfig')

    current_min_size=$(echo "$current_config" | jq -r '.minSize')
    current_desired_capacity=$(echo "$current_config" | jq -r '.desiredSize')

    echo "Current min-size: $current_min_size, desired-capacity: $current_desired_capacity" >&2

    echo "nodegroup_arn: $nodegroup_arn" >&2

    # Update the node group with the new values
    if aws eks update-nodegroup-config --cluster-name "$EKS_CLUSTER_NAME" --nodegroup-name "$nodegroup" --scaling-config minSize="$min_size",desiredSize="$desired_capacity"; then
      echo "Successfully updated $nodegroup to min-size $min_size and desired-capacity $desired_capacity." >&2

      # Tag the node group with the original min-size and desired-capacity
      echo "Tagging node group with original min-size and desired-capacity" >&2
      aws eks tag-resource --resource-arn "$nodegroup_arn" --tags \
        "panfactum/original-min-size=$current_min_size,panfactum/original-desired-capacity=$current_desired_capacity"
    else
      echo "Failed to update $nodegroup." >&2
    fi
  done
}

terminate_controller_nodes() {
  echo "Listing all EKS controller nodes..." >&2

  # Get all controller nodes by filtering on the label for EKS node groups (assuming controller nodes have specific labels)
  # Adjust the label as per your nodegroup's labeling scheme.
  nodes=$(kubectl "$CONTEXT_ARGS" get nodes -l panfactum.com/class=controller -o json | jq -r '.items[].metadata.name')

  if [[ -z $nodes ]]; then
    echo "No controller nodes found." >&2
  else
    echo "Found controller nodes, starting termination process..." >&2

    # Loop through each node
    for node in $nodes; do
      # Get the providerID for the node
      provider_id=$(kubectl "$CONTEXT_ARGS" get node "$node" -o json | jq -r '.spec.providerID')

      # Extract instance_id from the providerID (format: aws:///us-east-2a/i-00f7cadf689464acd)
      instance_id=$(echo "$provider_id" | awk -F '/' '{print $NF}')

      echo "Terminating EC2 instance $instance_id" >&2

      # Terminate the EC2 instance
      aws ec2 terminate-instances --instance-ids "$instance_id"

      echo "Waiting for instance termination..." >&2
      aws ec2 wait instance-terminated --instance-ids "$instance_id" --no-cli-pager

      echo "EC2 instance $instance_id terminated successfully." >&2
    done

    echo "All EKS controller nodes have been terminated." >&2
  fi
}

scale_asg_nat_nodes() {
  local prefix="nat-"
  local min_size=0
  local desired_capacity=0

  # Confirm scaling down NAT nodes. Other resources outside of the EKS cluster may be affected.
  read -rp "Are you sure you want to scale down NAT nodes? You should skip this if you have resources outside this cluster that depends on the NAT. [y/N]: " confirm
  if [[ ! $confirm =~ ^[yY]$ ]]; then
    echo "Aborted scaling down NAT nodes." >&2
    return
  fi

  # Step 1: Get the Subnet IDs associated with the EKS cluster
  vpc_id=$(aws eks describe-cluster --name "$EKS_CLUSTER_NAME" --query "cluster.resourcesVpcConfig.vpcId" --output text)
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

# Function to delete load balancers
delete_load_balancers() {
  # Retrieve all load balancer ARNs
  lb_arns=$(aws elbv2 describe-load-balancers --query "LoadBalancers[*].LoadBalancerArn" --output text)

  # Iterate through each load balancer to check tags and delete if matches
  for lb_arn in $lb_arns; do
    # Get the tags for the current load balancer
    tags=$(aws elbv2 describe-tags --resource-arns "$lb_arn" --query "TagDescriptions[0].Tags")

    # Check if the load balancer has the target tag using jq
    if echo "$tags" | jq -e ".[] | select(.Key == \"elbv2.k8s.aws/cluster\" and .Value == \"$EKS_CLUSTER_NAME\")" >/dev/null; then
      echo "Deleting load balancer: $lb_arn" >&2
      aws elbv2 delete-load-balancer --load-balancer-arn "$lb_arn"
    fi
  done

  echo "Load balancers deletion complete." >&2
}

increase_cert_expiration_duration() {
  local issuer_filter="internal"
  local duration="2160h" # 90 days

  # Get all certificates where issuer contains the provided filter, output as a list of namespace and certificate names
  certs=$(kubectl "$CONTEXT_ARGS" get certificate --all-namespaces -o json | jq -r ".items[] | select(.spec.issuerRef.name | contains(\"$issuer_filter\")) | [.metadata.namespace, .metadata.name] | @tsv")

  if [[ -z $certs ]]; then
    echo "No certificates found with an issuer containing '$issuer_filter'." >&2
    return 0
  fi

  # Loop through each certificate using a simple for loop
  while IFS=$'\t' read -r namespace cert_name; do
    echo "Processing certificate: $cert_name in namespace: $namespace" >&2

    # Patch the certificate to update the duration to 90 days (2160h)
    if kubectl patch certificate "$cert_name" -n "$namespace" --type='merge' -p "{\"spec\": {\"duration\": \"$duration\"}}"; then
      echo "Successfully updated certificate '$cert_name' in namespace '$namespace' to $duration." >&2
    else
      echo "Failed to update certificate '$cert_name' in namespace '$namespace'." >&2
    fi
  done <<<"$certs"
}

suspend() {
  # Validate the existence of kube/config
  validate_kube_config

  # Select the cluster and validate root aws profile
  select_cluster

  # Confirm the cluster selection
  confirmation

  # mark the cluster as suspended
  set_tag_to_cluster "panfactum.com/suspended" "true"

  # increase the certificate expiration duration
  increase_cert_expiration_duration

  # prevent karpenter from scheduling new nodes
  limit_karpenter_node_pools

  # terminate the karpenter nodes
  terminate_karpenter_nodes

  # scale down the controller nodes
  scale_eks_nodegroup_down 0 0

  # terminate the controller nodes
  terminate_controller_nodes

  # scale down the nat nodes
  scale_asg_nat_nodes 0 0

  # delete the load balancers
  delete_load_balancers
}

suspend
