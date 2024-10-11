// Live

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "5.70.0"
      configuration_aliases = [aws.secondary]
    }
    tls = {
      source  = "hashicorp/tls"
      version = "4.0.5"
    }
  }
}

locals {
  vpc_id                       = values(data.aws_subnet.control_plane_subnets)[0].vpc_id // a bit hacky but we can just assume all subnets are in the same aws_vpc
  controller_nodes_description = "Nodes for cluster-critical components and bootstrapping processes. Not autoscaled."

  # We omit some tags that change frequently from node group
  # instances b/c changing these tags forces the nodes to roll
  # which is a disruptive and time consuming operation
  instance_tags = {
    for k, v in module.tags.tags : k => v if !contains([
      "panfactum.com/stack-commit",
      "panfactum.com/stack-version"
    ], k)
  }
}

data "aws_region" "region" {}

module "tags" {
  source = "../aws_tags"

  # pf-generate: set_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}

module "constants" {
  source = "../kube_constants"

  # pf-generate: set_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}

module "node_settings" {
  source                 = "../kube_node_settings"
  cluster_name           = aws_eks_cluster.cluster.name
  cluster_ca_data        = aws_eks_cluster.cluster.certificate_authority[0].data
  cluster_dns_service_ip = var.dns_service_ip
  cluster_endpoint       = aws_eks_cluster.cluster.endpoint
  is_spot                = false

  # pf-generate: pass_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}

##########################################################################
## Main EKS Cluster
##########################################################################

resource "aws_eks_cluster" "cluster" {
  depends_on                = [module.aws_cloudwatch_log_group]
  enabled_cluster_log_types = var.control_plane_logging

  name     = var.cluster_name
  role_arn = aws_iam_role.eks_cluster_role.arn
  version  = var.kube_version

  vpc_config {
    subnet_ids              = [for subnet in data.aws_subnet.control_plane_subnets : subnet.id]
    endpoint_private_access = true
    endpoint_public_access  = var.enable_public_access
    public_access_cidrs     = var.public_access_cidrs
    security_group_ids      = [aws_security_group.control_plane.id]
  }

  kubernetes_network_config {
    service_ipv4_cidr = var.service_cidr
    ip_family         = "ipv4"
  }

  encryption_config {
    provider {
      key_arn = module.encrypt_key.arn
    }
    resources = ["secrets"]
  }

  tags = merge(module.tags.tags, {
    description = var.cluster_description
  })

  lifecycle {
    prevent_destroy = true
  }
}

data "aws_subnet" "control_plane_subnets" {
  for_each = var.control_plane_subnets
  vpc_id   = var.vpc_id
  filter {
    name   = "tag:Name"
    values = [each.value]
  }
}

resource "aws_ec2_tag" "subnet_tags" {
  for_each    = var.control_plane_subnets
  resource_id = data.aws_subnet.control_plane_subnets[each.key].id
  key         = "kubernetes.io/cluster/${var.cluster_name}"
  value       = "owned"
}

resource "aws_ec2_tag" "vpc_tags" {
  for_each    = toset([for sub in data.aws_subnet.control_plane_subnets : sub.vpc_id])
  resource_id = each.key
  key         = "kubernetes.io/cluster/${var.cluster_name}"
  value       = "owned"
}

resource "aws_security_group" "control_plane" {
  description = "Security group for the ${var.cluster_name} EKS control plane."
  vpc_id      = local.vpc_id
  tags = merge(module.tags.tags, {
    Name        = var.cluster_name
    description = "Security group for the ${var.cluster_name} EKS control plane."
  })
}

// This needs to be managed separately because they are included in the ignore_tags provider configuration
resource "aws_ec2_tag" "control_plane_kubernetes" {
  resource_id = aws_security_group.control_plane.id
  key         = "kubernetes.io/cluster/${var.cluster_name}"
  value       = "owned"
}


resource "aws_security_group_rule" "control_plane_nodes" {
  type                     = "ingress"
  description              = "Allow nodes to talk with API server."
  protocol                 = "tcp"
  from_port                = 443
  to_port                  = 443
  security_group_id        = aws_security_group.control_plane.id
  source_security_group_id = aws_security_group.all_nodes.id
}

resource "aws_security_group_rule" "control_plane_egress" {
  type              = "egress"
  description       = "Allow arbitrary outbound traffic."
  protocol          = -1
  from_port         = 0
  to_port           = 0
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.control_plane.id
}

resource "aws_iam_role" "eks_cluster_role" {
  name               = var.cluster_name
  assume_role_policy = data.aws_iam_policy_document.eks_assume_role.json
  managed_policy_arns = [
    "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy",
    "arn:aws:iam::aws:policy/AmazonEKSServicePolicy"
  ]
  tags = merge(module.tags.tags, {
    Name        = var.cluster_name
    description = "IAM role for the ${var.cluster_name} EKS control plane."
  })
}

data "aws_iam_policy_document" "eks_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      identifiers = ["eks.amazonaws.com"]
      type        = "Service"
    }
  }
}

module "encrypt_key" {
  source = "../aws_kms_encrypt_key"
  providers = {
    aws.secondary = aws.secondary
  }

  name        = "kube-${var.cluster_name}"
  description = "Encryption key for kubernetes control plane data"

  superuser_iam_arns         = var.superuser_iam_arns
  admin_iam_arns             = var.admin_iam_arns
  reader_iam_arns            = var.reader_iam_arns
  restricted_reader_iam_arns = var.restricted_reader_iam_arns

  # pf-generate: pass_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}

moved {
  from = aws_eks_addon.coredns
  to   = aws_eks_addon.coredns[0]
}

resource "aws_eks_addon" "coredns" {
  count                       = var.core_dns_addon_enabled ? 1 : 0
  cluster_name                = aws_eks_cluster.cluster.name
  addon_name                  = "coredns"
  addon_version               = var.coredns_version
  resolve_conflicts_on_update = "OVERWRITE"
  resolve_conflicts_on_create = "OVERWRITE"
}

resource "aws_eks_addon" "kube_proxy" {
  count                       = var.core_dns_addon_enabled ? 1 : 0
  cluster_name                = aws_eks_cluster.cluster.name
  addon_name                  = "coredns"
  addon_version               = var.coredns_version
  resolve_conflicts_on_update = "OVERWRITE"
  resolve_conflicts_on_create = "OVERWRITE"
}

////////////////////////////////////////////////////////////
// Logging and Monitoring
// Currently we use the default set provided by AWS to get access to control plane logs
// TODO: https://github.com/aws/containers-roadmap/issues/1141
////////////////////////////////////////////////////////////

module "aws_cloudwatch_log_group" {
  source      = "../aws_cloudwatch_log_group"
  name        = "/aws/eks/${var.cluster_name}/cluster"
  description = "Collects logs for our AWS EKS Cluster"

  # pf-generate: pass_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}

##########################################################################
## Node Groups
##########################################################################
data "aws_subnet" "node_groups" {
  for_each = toset(var.node_subnets)
  vpc_id   = var.vpc_id
  filter {
    name   = "tag:Name"
    values = [each.key]
  }
}

resource "aws_ec2_tag" "node_subnet_tags" {
  for_each    = toset(var.node_subnets)
  resource_id = data.aws_subnet.node_groups[each.key].id
  key         = "kubernetes.io/cluster/${var.cluster_name}"
  value       = "owned"
}

// Latest bottlerocket image
// See https://docs.aws.amazon.com/eks/latest/userguide/retrieve-ami-id-bottlerocket.html
data "aws_ssm_parameter" "controller_ami" {
  name = var.bootstrap_mode_enabled ? "/aws/service/bottlerocket/aws-k8s-${var.kube_version}/x86_64/latest/image_id" : "/aws/service/bottlerocket/aws-k8s-${var.kube_version}/arm64/latest/image_id"
}

resource "aws_launch_template" "controller" {
  name_prefix = "controller-"

  image_id = data.aws_ssm_parameter.controller_ami.insecure_value

  default_version         = 1
  disable_api_termination = false
  vpc_security_group_ids  = [aws_security_group.all_nodes.id]

  ebs_optimized = true
  user_data     = base64encode(module.node_settings.user_data)

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      delete_on_termination = "true"
      volume_size           = 25
      volume_type           = "gp3"
      encrypted             = "true"
    }
  }

  block_device_mappings {
    device_name = "/dev/xvdb"
    ebs {
      delete_on_termination = "true"
      volume_size           = 40
      volume_type           = "gp3"
      encrypted             = "true"
    }
  }

  metadata_options {
    http_endpoint               = "enabled"
    http_put_response_hop_limit = 1
    http_tokens                 = "required"
  }

  tag_specifications {
    resource_type = "instance"
    tags = merge(local.instance_tags,
      {
        Name        = "${var.cluster_name}-controller"
        description = local.controller_nodes_description
        eks-managed = "true"
      }
    )
  }

  tags = merge(module.tags.tags, {
    description = local.controller_nodes_description
  })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_eks_node_group" "controllers" {
  node_group_name_prefix = "controllers-"
  cluster_name           = var.cluster_name
  node_role_arn          = aws_iam_role.node_group.arn
  subnet_ids             = [for subnet in var.node_subnets : data.aws_subnet.node_groups[subnet].id]

  # We use amd64 instances while bootstrapping b/c some of the test commands require it;
  # after Karpenter is deployed (boostrapping is complete), we can switch to cheaper arm64 as Karpenter
  # will create amd64 instances if they are ever needed.
  instance_types = var.bootstrap_mode_enabled ? ["t3.large", "t3a.large"] : ["t4g.medium", "m6g.medium"]

  # Unlike Karpenter, applies of this module will fail if EKS cannot replace the nodes in the node groups
  # with updated versions due to being unable to evict modules. As a result, we enable force eviction
  # as these nodes should NOT be used to run workloads that are not capable of temporary disruption
  force_update_version = true

  launch_template {
    id      = aws_launch_template.controller.id
    version = aws_launch_template.controller.latest_version
  }

  # During bootstrapping, we want to have 3 nodes always as this is required
  # for bootstrapping core components like Vault; after bootstrapping, we can drop it to
  # 2 as Karpenter will take care of extra node provisioning. We need 2 so that
  # Karpenter can always be running even if one node is taken offline during the
  # upgrade process.
  scaling_config {
    desired_size = var.bootstrap_mode_enabled ? 3 : 2
    max_size     = var.bootstrap_mode_enabled ? 3 : 2
    min_size     = var.bootstrap_mode_enabled ? 3 : 2
  }
  update_config {
    max_unavailable_percentage = 50
  }

  # During bootstrapping, we should prevent disruptions as much as possible
  # but after Karpenter is running, we should make the EKS nodes spot as
  # they can already be disrupted at inconvenient times due to 'force_update_version = true'
  capacity_type = var.bootstrap_mode_enabled ? "ON_DEMAND" : "SPOT"

  tags = merge(local.instance_tags, {
    description = local.controller_nodes_description
  })
  labels = {
    "panfactum.com/class" = "controller"
  }
  taint {
    effect = "NO_SCHEDULE"
    key    = module.constants.cilium_taint.key
    value  = module.constants.cilium_taint.value
  }
  dynamic "taint" {
    for_each = var.bootstrap_mode_enabled ? toset([]) : toset(["burstable", "spot", "arm64"])
    content {
      effect = "NO_SCHEDULE"
      key    = taint.key
      value  = "true"
    }
  }

  // We only set the controller taint after bootstrapping is complete so that
  // pods scheduled by the test commands can run
  dynamic "taint" {
    for_each = var.bootstrap_mode_enabled ? toset([]) : toset(["controller"])
    content {
      effect = "NO_SCHEDULE"
      key    = taint.key
      value  = "true"
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

##########################################################################
## Security Groups
##########################################################################

////////////////////////////////////////////////////////////
// All nodes
////////////////////////////////////////////////////////////
data "aws_security_group" "all_nodes_source" {
  for_each = var.node_security_groups
  vpc_id   = var.vpc_id
  name     = each.key
}

resource "aws_security_group" "all_nodes" {
  description = "Security group for all nodes in the cluster"
  name_prefix = "${var.cluster_name}-nodes-"
  vpc_id      = local.vpc_id

  tags = merge(module.tags.tags, {
    Name        = "${var.cluster_name}-nodes"
    description = "Security group for all nodes in the ${var.cluster_name} EKS cluster"
  })
}

// These need to be managed separately because they are included in the ignore_tags provider configuration
resource "aws_ec2_tag" "all_nodes_kubernetes" {
  resource_id = aws_security_group.all_nodes.id
  key         = "kubernetes.io/cluster/${var.cluster_name}"
  value       = "owned"
}

resource "aws_security_group_rule" "ingress_self" {
  security_group_id = aws_security_group.all_nodes.id
  type              = "ingress"
  description       = "Allow node to communicate with each other."
  protocol          = "-1"
  from_port         = 0
  to_port           = 0
  self              = true
}

resource "aws_security_group_rule" "ingress_api_server" {
  security_group_id        = aws_security_group.all_nodes.id
  type                     = "ingress"
  description              = "Allow communication to the kubelet from the API server."
  protocol                 = "tcp"
  from_port                = 1025
  to_port                  = 65535
  source_security_group_id = aws_security_group.control_plane.id
}

resource "aws_security_group_rule" "ingress_api_extensions" {
  security_group_id        = aws_security_group.all_nodes.id
  type                     = "ingress"
  description              = "Allow communication to API server extensions."
  protocol                 = "tcp"
  from_port                = 443
  to_port                  = 443
  source_security_group_id = aws_security_group.control_plane.id
}

resource "aws_security_group_rule" "ingress_dynamic" {
  for_each                 = var.node_security_groups
  security_group_id        = aws_security_group.all_nodes.id
  type                     = "ingress"
  protocol                 = "-1"
  from_port                = 0
  to_port                  = 0
  source_security_group_id = data.aws_security_group.all_nodes_source[each.key].id
}

resource "aws_security_group_rule" "egress_all" {
  security_group_id = aws_security_group.all_nodes.id
  type              = "egress"
  description       = "Allow all outbound traffic from the nodes."
  protocol          = -1
  from_port         = 0
  to_port           = 0
  cidr_blocks       = ["0.0.0.0/0"]
}

##########################################################################
## IAM Provisioning
##########################################################################

resource "aws_iam_instance_profile" "node_group" {
  name_prefix = "${var.cluster_name}-node-"
  role        = aws_iam_role.node_group.name
  tags = merge(module.tags.tags, {
    description = "Instance profile for all nodes in the ${var.cluster_name} EKS cluster"
  })
  lifecycle {
    create_before_destroy = true
  }
}

data "aws_iam_policy_document" "node_group_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      identifiers = ["ec2.amazonaws.com"]
      type        = "Service"
    }
  }
}

resource "aws_iam_role" "node_group" {
  name_prefix           = "${var.cluster_name}-node-"
  assume_role_policy    = data.aws_iam_policy_document.node_group_assume_role.json
  force_detach_policies = true

  tags = merge(module.tags.tags, {
    description = "IAM role for all nodes in the ${var.cluster_name} EKS cluster"
  })

  lifecycle {
    create_before_destroy = true
  }
}

// See https://docs.aws.amazon.com/AmazonECR/latest/userguide/pull-through-cache.html#pull-through-cache-iam
// Also see https://docs.aws.amazon.com/AmazonECR/latest/userguide/repository-creation-templates.html#repository-creation-templates-iam
data "aws_iam_policy_document" "node_group_pull_through_cache_permissions" {
  statement {
    effect = "Allow"
    actions = [
      "ecr:CreateRepository",
      "ecr:BatchImportUpstreamImage",
      "ecr:TagResource",
      "ecr:PutLifecyclePolicy",
      "ecr:GetLifecyclePolicy",
      "ecr:GetLifecyclePolicyPreview",
      "ecr:SetRepositoryPolicy",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "node_group_pull_through_cache_permissions" {
  name_prefix = "nodes-ecr-pull-through-cache-"
  policy      = data.aws_iam_policy_document.node_group_pull_through_cache_permissions.json
}

resource "aws_iam_role_policy_attachment" "node_group_pull_through_cache_permissions" {
  policy_arn = aws_iam_policy.node_group_pull_through_cache_permissions.arn
  role       = aws_iam_role.node_group.name
}


// access to the container registries
resource "aws_iam_role_policy_attachment" "node_group_ecr" {
  role       = aws_iam_role.node_group.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

// required for the EKS kubelet to make calls to the AWS API
// server on the cluster's behalf
// https://docs.aws.amazon.com/eks/latest/userguide/create-node-role.html
resource "aws_iam_role_policy_attachment" "node_group_worker_policy" {
  role       = aws_iam_role.node_group.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
}

// TODO: This needs to be limited to the service account
// https://docs.aws.amazon.com/eks/latest/userguide/cni-iam-role.html
resource "aws_iam_role_policy_attachment" "node_group_ci" {
  role       = aws_iam_role.node_group.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
}

// Gives access to ssm systems manager
resource "aws_iam_role_policy_attachment" "node_group_ssm" {
  role       = aws_iam_role.node_group.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

##########################################################################
## IRSA
##########################################################################

data "tls_certificate" "cluster" {
  url = aws_eks_cluster.cluster.identity[0].oidc[0].issuer
}

resource "aws_iam_openid_connect_provider" "provider" {
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [for cert in data.tls_certificate.cluster.certificates : cert.sha1_fingerprint]
  url             = aws_eks_cluster.cluster.identity[0].oidc[0].issuer

  tags = merge(module.tags.tags, {
    description = "Gives the ${var.cluster_name} EKS cluster access to AWS roles via IRSA"
  })
}
