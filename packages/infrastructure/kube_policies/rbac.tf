locals {
  resource_rows = [for row in split("\n", file("${path.module}/resources.txt")) : split(" ", row) if length(row) > 1]

  // These are resources where read access should be explicitly granted
  // because they can contain sensitive information
  secret_resources = ["secrets"]

  // These are resources where write access should be explicitly granted
  // because they can be misused to bypass RBAC and/or cause cluster failures
  sensitive_resources = [

    // Can be misused to escalate privileges
    "clusterroles",
    "clusterrolebindings",
    "roles",
    "rolebindings",

    // Can be misused to bypass RBAC and can cause cluster failures
    "apiservices",
    "validatingadmissionpolicies",
    "mutatingwebhookconfigurations",
    "validatingadmissionpolicybindings",
    "validatingwebhookconfigurations",

    // Can cause DOS if misconfigured
    "flowschemas",
    "prioritylevelconfigurations",

    // Can break cluster functionality if changed
    "customresourcedefinitions",

    // Can be used to bypass RBAC and cause cluster failures if misconfigured
    "clustercleanuppolicies",
    "clusterpolicies",
    "policyexceptions"
  ]
  non_secret_resources = { for row in local.resource_rows : row[1] => {
    resources = tolist(setsubtract(toset(split(",", row[0])), toset(local.secret_resources)))
    api_group = row[1]
  } }

  non_sensitive_resources = { for k, v in { for row in local.resource_rows : row[1] => {
    resources = tolist(setsubtract(toset(split(",", row[0])), toset(concat(local.secret_resources, local.sensitive_resources))))
    api_group = row[1]
  } } : k => v if length(v.resources) > 0 }

  all_verbs  = ["get", "list", "watch", "create", "delete", "patch", "update"]
  read_verbs = ["get", "list", "watch"]
  list_verbs = ["list"]
}

resource "kubernetes_cluster_role" "admins" {
  metadata {
    name   = "pf:admins"
    labels = data.pf_kube_labels.labels.labels
  }
  dynamic "rule" {
    for_each = local.non_sensitive_resources
    content {
      api_groups = [rule.value.api_group, ""]
      resources  = rule.value.resources
      verbs      = local.all_verbs
    }
  }

  rule {
    api_groups = [""]
    resources  = ["pods/log", "pods/exec", "pods/attach", "secrets"]
    verbs      = local.all_verbs
  }
  rule {
    api_groups = ["networking.k8s.io"]
    resources  = ["ingresses/status"]
    verbs      = local.all_verbs
  }
  rule {
    api_groups = ["rbac.authorization.k8s.io"]
    resources  = ["clusterroles", "clusterrolebindings", "roles", "rolebindings"]
    verbs      = local.read_verbs
  }

  rule {
    api_groups = ["apiregistration.k8s.io"]
    resources  = ["apiservices"]
    verbs      = local.read_verbs
  }
  rule {
    api_groups = ["flowcontrol.apiserver.k8s.io"]
    resources = [
      "flowschemas",
      "prioritylevelconfigurations"
    ]
    verbs = local.read_verbs
  }

  rule {
    api_groups = ["admissionregistration.k8s.io"]
    resources = [
      "validatingadmissionpolicies",
      "mutatingwebhookconfigurations",
      "validatingadmissionpolicybindings",
      "validatingwebhookconfigurations"
    ]
    verbs = local.read_verbs
  }

  rule {
    api_groups = ["apiextensions.k8s.io"]
    resources = [
      "customresourcedefinitions",
    ]
    verbs = local.read_verbs
  }

  rule {
    api_groups = ["kyverno.io"]
    resources = [
      "clustercleanuppolicies",
      "clusterpolicies",
      "policyexceptions"
    ]
    verbs = local.read_verbs
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
