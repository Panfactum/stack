terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.22"
    }
  }
}

locals {
  namespace = kubernetes_namespace.main.metadata[0].name // shorthand for forcing the dependency graph
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

module "namespace_labels" {
  source = "../../modules/kube_labels"
  additional_labels = {
    // https://kubernetes-sigs.github.io/aws-load-balancer-controller/v2.4/deploy/pod_readiness_gate/
    "elbv2.k8s.aws/pod-readiness-gate-inject" = "enabled"
    "loadbalancer/enabled" = var.loadbalancer_enabled ? "true" : "false"
  }
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

######################### Namespace #######################################

resource "kubernetes_namespace" "main" {
  metadata {
    name   = var.namespace
    labels = module.namespace_labels.kube_labels
    annotations = merge({},
      var.linkerd_inject ? { "linkerd.io/inject" = "enabled" } : {}
    )
  }
}

###########################################################################
### RBAC for each Namespace
##########################################################################

######################### Admin #######################################
// Can do everything in the namespace

resource "kubernetes_role" "admins" {
  metadata {
    name      = "namespace:admin"
    namespace = local.namespace
    labels    = module.kube_labels.kube_labels
  }
  rule {
    api_groups = ["", "*"]
    resources  = ["*"]
    verbs      = ["*"]
  }
}


resource "kubernetes_role_binding" "admins" {
  count = min(length(var.admin_groups), 1)
  metadata {
    name      = "namespace:admins"
    namespace = local.namespace
    labels    = module.kube_labels.kube_labels
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.admins.metadata[0].name
  }
  dynamic "subject" {
    for_each = toset(var.admin_groups)
    content {
      kind      = "Group"
      name      = subject.key
      api_group = "rbac.authorization.k8s.io"
    }
  }
}

######################### Reader #######################################

resource "kubernetes_role" "readers" {
  metadata {
    name      = "namespace:reader"
    namespace = local.namespace
    labels    = module.kube_labels.kube_labels
  }

  rule {
    api_groups = ["cert-manager.io"]
    resources  = ["certificates", "certificaterequests", "issuers"]
    verbs      = ["get", "list", "watch"]
  }
  rule {
    api_groups = ["acme.cert-manager.io"]
    resources  = ["challenges", "orders"]
    verbs      = ["get", "list", "watch"]
  }
  rule {
    api_groups = [""]
    resources = [
      "pods",
      "pods/logs",
      "pods/status",
      "bindings",
      "events",
      "limitranges",
      "namespaces",
      "namespaces/status",
      "configmaps",
      "endpoints",
      "persistentvolumeclaims",
      "persistentvolumeclaims/status",
      "replicationcontrollers",
      "replicationcontrollers/status",
      "resourcequotas",
      "resourcequotas/status",
      "serviceaccounts",
      "services",
      "services/status"
    ]
    verbs = ["get", "list", "watch"]
  }
  rule {
    api_groups = ["apps"]
    resources = [
      "controllerversions",
      "daemonsets",
      "daemonsets/status",
      "deployments",
      "deployments/status",
      "replicasets",
      "replicasets/status",
      "statefulsets",
      "statefulsets/status"
    ]
    verbs = ["get", "list", "watch"]
  }
  rule {
    api_groups = ["autoscaling"]
    resources  = ["horizontalpodautoscalers", "horizontalpodautoscalers/status"]
    verbs      = ["get", "list", "watch"]
  }
  rule {
    api_groups = ["batch"]
    resources  = ["cronjobs", "cronjobs/status", "jobs", "jobs/status"]
    verbs      = ["get", "list", "watch"]
  }
  rule {
    api_groups = ["extensions"]
    resources = [
      "daemonsets",
      "daemonsets/status",
      "deployments",
      "deployments/status",
      "ingresses",
      "ingresses/status",
      "networkpolicies",
      "replicasets",
      "replicasets/status"
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
    resources  = ["roles", "rolebindings"]
    verbs      = ["get", "list", "watch"]
  }

}


resource "kubernetes_role_binding" "readers" {
  count = min(length(var.reader_groups), 1)
  metadata {
    name      = "namespace:readers"
    namespace = local.namespace
    labels    = module.kube_labels.kube_labels
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.readers.metadata[0].name
  }
  dynamic "subject" {
    for_each = toset(var.reader_groups)
    content {
      kind      = "Group"
      name      = subject.key
      api_group = "rbac.authorization.k8s.io"
    }
  }
}

######################### Bot Reader #######################################

resource "kubernetes_role" "bot_readers" {
  metadata {
    name      = "namespace:bot-reader"
    namespace = local.namespace
    labels    = module.kube_labels.kube_labels
  }
  rule {
    api_groups = [""]
    resources  = ["secrets"]
    verbs      = ["get", "list", "watch"]
  }
}


resource "kubernetes_role_binding" "bot_readers" {
  count = min(length(var.bot_reader_groups), 1)
  metadata {
    name      = "namespace:bot-readers"
    namespace = local.namespace
    labels    = module.kube_labels.kube_labels
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.readers.metadata[0].name
  }
  dynamic "subject" {
    for_each = toset(var.bot_reader_groups)
    content {
      kind      = "Group"
      name      = subject.key
      api_group = "rbac.authorization.k8s.io"
    }
  }
}

resource "kubernetes_role_binding" "bot_readers_extra" {
  count = min(length(var.bot_reader_groups), 1)
  metadata {
    name      = "namespace:bot-readers-extra"
    namespace = local.namespace
    labels    = module.kube_labels.kube_labels
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.bot_readers.metadata[0].name
  }
  dynamic "subject" {
    for_each = toset(var.bot_reader_groups)
    content {
      kind      = "Group"
      name      = subject.key
      api_group = "rbac.authorization.k8s.io"
    }
  }
}
