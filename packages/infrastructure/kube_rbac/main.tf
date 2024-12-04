terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "5.80.0"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.3"
    }
  }
}

locals {
  restricted_readers_group = "system:restricted-readers"
  readers_group            = "system:readers"
  admins_group             = "system:admins"
  superusers_group         = "system:superusers"


  superuser_role_arns = tolist(toset(concat(
    var.kube_superuser_role_arns,
    [
      for parts in [for arn in data.aws_iam_roles.superuser.arns : split("/", arn)] :
      format("%s/%s", parts[0], element(parts, length(parts) - 1))
    ]
  )))
  admin_role_arns = tolist(toset(concat(
    var.kube_admin_role_arns,
    [
      for parts in [for arn in data.aws_iam_roles.admin.arns : split("/", arn)] :
      format("%s/%s", parts[0], element(parts, length(parts) - 1))
    ]
  )))
  reader_role_arns = tolist(toset(concat(
    var.kube_reader_role_arns,
    [
      for parts in [for arn in data.aws_iam_roles.reader.arns : split("/", arn)] :
      format("%s/%s", parts[0], element(parts, length(parts) - 1))
    ]
  )))
  restricted_reader_role_arns = tolist(toset(concat(
    var.kube_restricted_reader_role_arns,
    [
      for parts in [for arn in data.aws_iam_roles.restricted_reader.arns : split("/", arn)] :
      format("%s/%s", parts[0], element(parts, length(parts) - 1))
    ]
  )))

  resource_rows    = [for row in split("\n", file("${path.module}/resources.txt")) : split(" ", row) if length(row) > 1]
  secret_resources = ["secrets"]
  non_secret_resources = { for row in local.resource_rows : row[1] => {
    resources = tolist(setsubtract(toset(split(",", row[0])), toset(local.secret_resources)))
    api_group = row[1]
  } }
}

data "pf_kube_labels" "labels" {
  module = "kube_rbac"
}

////////////////////////////////////////////////////////////
// User Authentication
// See https://kubernetes.io/docs/reference/access-authn-authz/rbac/#user-facing-roles
////////////////////////////////////////////////////////////

/*******************  Superuser Permissions ***********************/

data "aws_iam_roles" "superuser" {
  name_regex  = "AWSReservedSSO_Superuser.*"
  path_prefix = "/aws-reserved/sso.amazonaws.com/"
}

resource "kubernetes_cluster_role_binding" "superusers" {
  metadata {
    name   = local.superusers_group
    labels = data.pf_kube_labels.labels.labels
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = "cluster-admin" // built-in role
  }
  subject {
    kind      = "Group"
    name      = local.superusers_group
    api_group = "rbac.authorization.k8s.io"
  }
}

/*******************  Admin Permissions ***********************/

data "aws_iam_roles" "admin" {
  name_regex  = "AWSReservedSSO_Admin.*"
  path_prefix = "/aws-reserved/sso.amazonaws.com/"
}

resource "kubernetes_cluster_role" "admins" {
  metadata {
    name   = local.admins_group
    labels = data.pf_kube_labels.labels.labels
  }
  rule {
    api_groups = [""]
    resources  = ["nodes", "namespaces", "pods", "configmaps", "services", "roles", "secrets"]
    verbs      = ["get", "list", "watch"]
  }
  rule {
    api_groups = ["apps"]
    resources = [
      "daemonsets",
      "deployments",
      "replicasets",
      "statefulsets",
    ]
    verbs = ["get", "list", "watch"]
  }
  rule {
    api_groups = ["policy"]
    resources  = ["poddisruptionbudgets", "poddisruptionbudgets/status"]
    verbs      = ["get", "list", "watch"]
  }
  rule {
    api_groups = ["networking.k8s.io"]
    resources  = ["ingresses", "ingresses/status", "networkpolicies"]
    verbs      = ["get", "list", "watch"]
  }
  rule {
    api_groups = ["metrics.k8s.io"]
    resources  = ["pods", "nodes"]
    verbs      = ["get", "list", "watch"]
  }
  rule {
    api_groups = ["rbac.authorization.k8s.io"]
    resources  = ["clusterroles", "clusterrolebindings"]
    verbs      = ["get", "list", "watch"]
  }
}


resource "kubernetes_cluster_role_binding" "admins" {
  metadata {
    name   = local.admins_group
    labels = data.pf_kube_labels.labels.labels
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.admins.metadata[0].name
  }
  subject {
    kind      = "Group"
    name      = local.admins_group
    api_group = "rbac.authorization.k8s.io"
  }
}

/*******************  Reader Permissions ***********************/

data "aws_iam_roles" "reader" {
  name_regex  = "AWSReservedSSO_Reader.*"
  path_prefix = "/aws-reserved/sso.amazonaws.com/"
}

resource "kubernetes_cluster_role" "readers" {
  metadata {
    name   = local.readers_group
    labels = data.pf_kube_labels.labels.labels
  }
  rule {
    api_groups = ["*"]
    resources  = ["*"]
    verbs      = ["get", "list", "watch", "view"]
  }
}

resource "kubernetes_cluster_role_binding" "readers" {
  metadata {
    name   = local.readers_group
    labels = data.pf_kube_labels.labels.labels
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.readers.metadata[0].name
  }
  subject {
    kind      = "Group"
    name      = local.readers_group
    api_group = "rbac.authorization.k8s.io"
  }
}

/*******************  Restricted Reader Permissions ***********************/

data "aws_iam_roles" "restricted_reader" {
  name_regex  = "AWSReservedSSO_RestrictedReader.*"
  path_prefix = "/aws-reserved/sso.amazonaws.com/"
}

resource "kubernetes_cluster_role" "restricted_readers" {
  metadata {
    name   = local.restricted_readers_group
    labels = data.pf_kube_labels.labels.labels
  }
  dynamic "rule" {
    for_each = local.non_secret_resources
    content {
      api_groups = [rule.value.api_group, ""]
      resources  = rule.value.resources
      verbs      = ["list", "get", "watch"]
    }
  }
  rule {
    api_groups = [""]
    resources  = ["pods/log"]
    verbs      = ["get", "list"]
  }
  rule {
    api_groups = ["metrics.k8s.io"]
    resources  = ["*"]
    verbs      = ["get", "list"]
  }
  rule {
    api_groups = [""]
    resources  = ["secrets"]
    verbs      = ["list"]
  }
}

resource "kubernetes_cluster_role_binding" "restricted_readers" {
  metadata {
    name   = local.restricted_readers_group
    labels = data.pf_kube_labels.labels.labels
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.restricted_readers.metadata[0].name
  }
  subject {
    kind      = "Group"
    name      = local.restricted_readers_group
    api_group = "rbac.authorization.k8s.io"
  }
}

/*******************  IAM Mappings ***********************/
// See https://github.com/kubernetes-sigs/aws-iam-authenticator

data "aws_caller_identity" "current" {}

resource "kubernetes_config_map" "aws_auth" {
  metadata {
    name      = "aws-auth"
    namespace = "kube-system"
    labels    = data.pf_kube_labels.labels.labels
  }
  data = {
    mapUsers = yamlencode([
      {
        groups   = [local.superusers_group]
        userarn  = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        username = "root"
      }
    ])
    mapRoles = yamlencode(concat(

      // allows nodes to register with the cluster
      [{
        rolearn  = var.aws_node_role_arn
        username = "system:node:{{EC2PrivateDNSName}}"
        groups   = ["system:bootstrappers", "system:nodes"]
      }],

      // allows access to superusers
      [for arn in local.superuser_role_arns : {
        rolearn  = arn
        username = "{{SessionName}}"
        groups   = [local.superusers_group]
      }],

      // allows access to admins
      [for arn in local.admin_role_arns : {
        rolearn  = arn
        username = "{{SessionName}}"
        groups   = [local.admins_group]
      }],

      // allows access to read only
      [for arn in local.reader_role_arns : {
        rolearn  = arn
        username = "{{SessionName}}"
        groups   = [local.readers_group]
      }],

      // allows access to restricted read only
      [for arn in local.restricted_reader_role_arns : {
        rolearn  = arn
        username = "{{SessionName}}"
        groups   = [local.restricted_readers_group]
      }]
    ))
  }
}
