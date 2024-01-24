// Live

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.22"
    }
  }
}

locals {
  readers_group     = "system:readers"
  bot_readers_group = "system:bot-readers"
  admins_group      = "system:admins"
  superusers_group  = "system:superusers"
}

module "kube_labels" {
  source = "../../modules/kube_labels"
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

////////////////////////////////////////////////////////////
// User Authentication
// See https://kubernetes.io/docs/reference/access-authn-authz/rbac/#user-facing-roles
////////////////////////////////////////////////////////////

/*******************  Superuser Permissions ***********************/
// Access to everything

resource "kubernetes_cluster_role_binding" "superusers" {
  metadata {
    name   = local.superusers_group
    labels = module.kube_labels.kube_labels
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
// Access to a handful of resources globally
// The rest of the access is on a per-namespace basis

resource "kubernetes_cluster_role" "admins" {
  metadata {
    name   = local.admins_group
    labels = module.kube_labels.kube_labels
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
    labels = module.kube_labels.kube_labels
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
// Access to a handful of resources globally
// The rest of the access is on a per-namespace basis

resource "kubernetes_cluster_role" "readers" {
  metadata {
    name   = local.readers_group
    labels = module.kube_labels.kube_labels
  }
  rule {
    api_groups = [""]
    resources  = ["nodes", "namespaces", "pods", "configmaps", "services", "roles"]
    verbs      = ["get", "list", "watch"]
  }
  rule {
    api_groups = [""]
    resources  = ["secrets"]
    verbs      = ["list"]
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

resource "kubernetes_cluster_role_binding" "readers" {
  metadata {
    name   = local.readers_group
    labels = module.kube_labels.kube_labels
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

/*******************  Bot Reader Permissions ***********************/
// Access to a handful of resources globally
// The rest of the access is on a per-namespace basis

resource "kubernetes_cluster_role" "bot_readers" {
  metadata {
    name   = local.bot_readers_group
    labels = module.kube_labels.kube_labels
  }
  rule {
    api_groups = [""]
    resources  = ["nodes", "namespaces"]
    verbs      = ["get", "list", "watch"]
  }
  rule {
    api_groups = ["rbac.authorization.k8s.io"]
    resources  = ["clusterroles", "clusterrolebindings"]
    verbs      = ["get", "list", "watch"]
  }
  rule {
    api_groups = ["apiextensions.k8s.io"]
    resources  = ["customresourcedefinitions"]
    verbs      = ["get", "list", "watch"]
  }
}

resource "kubernetes_cluster_role_binding" "bot_readers" {
  metadata {
    name   = local.bot_readers_group
    labels = module.kube_labels.kube_labels
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.bot_readers.metadata[0].name
  }
  subject {
    kind      = "Group"
    name      = local.bot_readers_group
    api_group = "rbac.authorization.k8s.io"
  }
}

/*******************  IAM Mappings ***********************/
// See https://github.com/kubernetes-sigs/aws-iam-authenticator

resource "kubernetes_config_map" "aws_auth" {
  metadata {
    name      = "aws-auth"
    namespace = "kube-system"
    labels    = module.kube_labels.kube_labels
  }
  data = {
    mapRoles = yamlencode(concat(

      // allows nodes to register with the cluster
      [{
        rolearn  = var.aws_node_role_arn
        username = "system:node:{{EC2PrivateDNSName}}"
        groups   = ["system:bootstrappers", "system:nodes"]
      }],

      // allows access to superusers
      [for arn in var.kube_superuser_role_arns : {
        rolearn  = arn
        username = "{{SessionName}}"
        groups   = [local.superusers_group]
      }],

      // allows access to admins
      [for arn in var.kube_admin_role_arns : {
        rolearn  = arn
        username = "{{SessionName}}"
        groups   = [local.admins_group]
      }],

      // allows access to read only
      [for arn in var.kube_reader_role_arns : {
        rolearn  = arn
        username = "{{SessionName}}"
        groups   = [local.readers_group]
      }],

      // allows access to bot read only
      [for arn in var.kube_bot_reader_role_arns : {
        rolearn  = arn
        username = "{{SessionName}}"
        groups   = [local.bot_readers_group]
      }]
    ))
  }
}
