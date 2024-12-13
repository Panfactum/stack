locals {
  resource_rows    = [for row in split("\n", file("${path.module}/resources.txt")) : split(" ", row) if length(row) > 1]
  secret_resources = ["secrets"]
  non_secret_resources = { for row in local.resource_rows : row[1] => {
    resources = tolist(setsubtract(toset(split(",", row[0])), toset(local.secret_resources)))
    api_group = row[1]
  } }

  all_verbs  = ["get", "list", "watch", "create", "delete", "patch", "update"]
  read_verbs = ["get", "list", "watch", "create", "delete", "patch", "update"]
  list_verbs = ["list"]
}

resource "kubernetes_cluster_role" "admins" {
  metadata {
    name   = "pf:admins"
    labels = data.pf_kube_labels.labels.labels
  }
  dynamic "rule" {
    for_each = local.non_secret_resources
    content {
      api_groups = [rule.value.api_group, ""]
      resources  = rule.value.resources
      verbs      = local.all_verbs
    }
  }
  rule {
    api_groups = [""]
    resources  = ["nodes", "namespaces", "pods", "configmaps", "services", "roles", "secrets"]
    verbs      = local.all_verbs
  }
  rule {
    api_groups = ["apps"]
    resources = [
      "daemonsets",
      "deployments",
      "replicasets",
      "statefulsets",
    ]
    verbs = local.all_verbs
  }
  rule {
    api_groups = ["policy"]
    resources  = ["poddisruptionbudgets", "poddisruptionbudgets/status"]
    verbs      = local.all_verbs
  }
  rule {
    api_groups = ["networking.k8s.io"]
    resources  = ["ingresses", "ingresses/status", "networkpolicies"]
    verbs      = local.all_verbs
  }
  rule {
    api_groups = ["metrics.k8s.io"]
    resources  = ["pods", "nodes"]
    verbs      = local.all_verbs
  }
  rule {
    api_groups = ["rbac.authorization.k8s.io"]
    resources  = ["clusterroles", "clusterrolebindings"]
    verbs      = local.read_verbs
  }
}

resource "kubernetes_cluster_role_binding" "admins" {
  metadata {
    name   = kubernetes_cluster_role.admins.metadata[0].name
    labels = data.pf_kube_labels.labels.labels
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.admins.metadata[0].name
  }
  subject {
    kind      = "Group"
    name      = kubernetes_cluster_role.admins.metadata[0].name
    api_group = "rbac.authorization.k8s.io"
  }
}

resource "kubernetes_cluster_role" "restricted_readers" {
  metadata {
    name   = "pf:restricted-readers"
    labels = data.pf_kube_labels.labels.labels
  }
  dynamic "rule" {
    for_each = local.non_secret_resources
    content {
      api_groups = [rule.value.api_group, ""]
      resources  = rule.value.resources
      verbs      = local.read_verbs
    }
  }
  rule {
    api_groups = [""]
    resources  = ["pods/log"]
    verbs      = local.read_verbs
  }
  rule {
    api_groups = ["metrics.k8s.io"]
    resources  = ["*"]
    verbs      = local.read_verbs
  }
  rule {
    api_groups = [""]
    resources  = ["secrets"]
    verbs      = local.list_verbs
  }
}

resource "kubernetes_cluster_role_binding" "restricted_readers" {
  metadata {
    name   = kubernetes_cluster_role.restricted_readers.metadata[0].name
    labels = data.pf_kube_labels.labels.labels
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.restricted_readers.metadata[0].name
  }
  subject {
    kind      = "Group"
    name      = kubernetes_cluster_role.restricted_readers.metadata[0].name
    api_group = "rbac.authorization.k8s.io"
  }
}