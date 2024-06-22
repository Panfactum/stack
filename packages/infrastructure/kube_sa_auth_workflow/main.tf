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
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
  }
}

locals {
  bucket = yamldecode(data.kubernetes_config_map.artifact_config.data.s3).s3.bucket
}

resource "random_id" "role_id" {
  prefix      = "${var.service_account}-"
  byte_length = 8
}

module "util_scale_to_zero" {
  source = "../kube_workload_utility"

  workload_name = var.service_account

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

resource "kubernetes_role" "role" {
  metadata {
    name      = random_id.role_id.hex
    namespace = var.service_account_namespace
    labels    = module.util_scale_to_zero.labels
  }
  rule {
    api_groups = ["argoproj.io"]
    resources  = ["workflowtaskresults"]
    verbs      = ["create", "patch"]
  }
}

resource "kubernetes_role_binding" "role_binding" {
  metadata {
    name      = random_id.role_id.hex
    namespace = var.service_account_namespace
    labels    = module.util_scale_to_zero.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = var.service_account
    namespace = var.service_account_namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.role.metadata[0].name
  }
}

data "kubernetes_config_map" "artifact_config" {
  metadata {
    name      = "artifact-repositories"
    namespace = "argo"
  }
}

data "aws_iam_policy_document" "artifact_access" {
  statement {
    effect  = "Allow"
    actions = ["s3:*"]
    resources = [
      "arn:aws:s3:::${local.bucket}",
      "arn:aws:s3:::${local.bucket}/*"
    ]
  }
}

module "aws_permissions" {
  source = "../kube_sa_auth_aws"

  service_account           = var.service_account
  service_account_namespace = var.service_account_namespace
  eks_cluster_name          = var.eks_cluster_name
  iam_policy_json           = data.aws_iam_policy_document.artifact_access.json
  ip_allow_list             = var.ip_allow_list
  annotate_service_account  = var.annotate_service_account

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
