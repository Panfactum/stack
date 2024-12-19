terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.80.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.34.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.1.3"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.7"
    }
  }
}

locals {
  bucket = yamldecode(data.kubernetes_config_map.artifact_config.data.s3).s3.bucket
}

data "pf_kube_labels" "labels" {
  module = "kube_sa_auth_workflow"
}

resource "random_id" "role_id" {
  prefix      = "${var.service_account}-"
  byte_length = 8
}

resource "kubernetes_role" "role" {
  metadata {
    name      = random_id.role_id.hex
    namespace = var.service_account_namespace
    labels    = data.pf_kube_labels.labels.labels
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
    labels    = data.pf_kube_labels.labels.labels
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

data "aws_iam_policy_document" "aws_access" {
  statement {
    effect  = "Allow"
    actions = ["s3:*"]
    resources = [
      "arn:aws:s3:::${local.bucket}",
      "arn:aws:s3:::${local.bucket}/*"
    ]
  }
  override_policy_documents = [var.extra_aws_permissions]
}

module "aws_permissions" {
  source = "../kube_sa_auth_aws"

  service_account           = var.service_account
  service_account_namespace = var.service_account_namespace
  iam_policy_json           = data.aws_iam_policy_document.aws_access.json
  ip_allow_list             = var.ip_allow_list
  annotate_service_account  = var.annotate_service_account
}
