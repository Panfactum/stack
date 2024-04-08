terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.39.1"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
  }
}

locals {
  kube_oidc_provider = trimprefix(data.aws_eks_cluster.cluster.identity[0].oidc[0].issuer, "https://")
  ip_allow_list_with_defaults = concat(
    var.ip_allow_list,
    [for subnet in data.aws_subnet.cluster_subnet_info : subnet.tags["panfactum.com/public-ip"] if contains(keys(subnet.tags), "panfactum.com/public-ip")],
    [for subnet in data.aws_subnet.cluster_subnet_info : subnet.cidr_block]
  )
}

data "aws_caller_identity" "main" {}
data "aws_region" "main" {}

module "tags" {
  source = "../aws_tags"

  pf_stack_type    = var.pf_stack_type
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  extra_tags       = var.extra_tags
  is_local         = var.is_local
}

# ################################################################################
# IP Auto Discovery
# ################################################################################

data "aws_subnets" "cluster_subnets" {
  filter {
    name   = "tag-key"
    values = ["kubernetes.io/cluster/${var.eks_cluster_name}"]
  }
}

data "aws_subnet" "cluster_subnet_info" {
  for_each = toset(data.aws_subnets.cluster_subnets.ids)
  id       = each.key
}

# ################################################################################
# IAM Permissions
# ################################################################################

resource "aws_iam_policy" "service_account" {
  name_prefix = "${var.service_account}-"
  description = "Provides IAM permissions for ${var.service_account_namespace}/${var.service_account} in ${var.eks_cluster_name}."
  policy      = var.iam_policy_json
  tags = merge(module.tags.tags, {
    description = "Provides IAM permissions for ${var.service_account_namespace}/${var.service_account} in ${var.eks_cluster_name}."
  })
}

data "aws_eks_cluster" "cluster" {
  name = var.eks_cluster_name
}

data "aws_iam_policy_document" "service_account_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.main.account_id}:oidc-provider/${local.kube_oidc_provider}"]
      type        = "Federated"
    }
    condition {
      test     = "StringEquals"
      values   = ["system:serviceaccount:${var.service_account_namespace}:${var.service_account}"]
      variable = "${local.kube_oidc_provider}:sub"
    }
  }
}

resource "aws_iam_role" "service_account" {
  name_prefix        = "${var.service_account}-"
  description        = "IAM role for ${var.service_account_namespace}/${var.service_account} in ${var.eks_cluster_name}."
  assume_role_policy = data.aws_iam_policy_document.service_account_assume.json
  tags = merge(module.tags.tags, {
    description = "IAM role for ${var.service_account_namespace}/${var.service_account} in ${var.eks_cluster_name}."
  })
  max_session_duration = 43200
}

resource "aws_iam_policy_attachment" "service_account" {
  name       = aws_iam_policy.service_account.name
  policy_arn = aws_iam_policy.service_account.arn
  roles      = [aws_iam_role.service_account.name]
}

data "aws_iam_policy_document" "ip_blocks" {
  statement {
    effect    = "Deny"
    resources = ["*"]
    // Since we use vpc endpoints for S3
    // we need to ignore them for this global deny
    not_actions = ["s3:*"]

    // Only allow access from inside our cluster
    condition {
      test     = "NotIpAddress"
      values   = local.ip_allow_list_with_defaults
      variable = "aws:SourceIp"
    }
  }

  statement {
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = ["*"]

    // Only allow access from inside our cluster
    condition {
      test     = "NotIpAddress"
      values   = local.ip_allow_list_with_defaults
      variable = "aws:VpcSourceIp"
    }
  }
}

resource "aws_iam_policy" "ip_blocks" {
  name_prefix = "${var.service_account}-ip-blocks-"
  description = "Restricts ${var.service_account_namespace}/${var.service_account} in ${var.eks_cluster_name} to cluster IPs."
  policy      = data.aws_iam_policy_document.ip_blocks.json
  tags = merge(module.tags.tags, {
    description = "Restricts ${var.service_account_namespace}/${var.service_account} in ${var.eks_cluster_name} to cluster IPs."
  })
}

resource "aws_iam_policy_attachment" "ip_blocks" {
  name       = "${aws_iam_policy.service_account.name}-ip-blocks"
  policy_arn = aws_iam_policy.ip_blocks.arn
  roles      = [aws_iam_role.service_account.name]
}

# ################################################################################
# Provide the annotation required by IRSA
# ################################################################################

resource "kubernetes_annotations" "service_account" {
  count       = var.annotate_service_account ? 1 : 0
  api_version = "v1"
  kind        = "ServiceAccount"
  metadata {
    name      = var.service_account
    namespace = var.service_account_namespace
  }
  field_manager = "terraform-aws"
  force         = true
  annotations = {
    "eks.amazonaws.com/role-arn" = aws_iam_role.service_account.arn
  }
}
