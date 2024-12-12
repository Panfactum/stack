terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.34.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.1.3"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.5"
    }
  }
}

locals {
  namespace = kubernetes_namespace.main.metadata[0].name // shorthand for forcing the dependency graph

  extra_labels = merge(var.extra_labels, {
    // https://kubernetes-sigs.github.io/aws-load-balancer-controller/v2.4/deploy/pod_readiness_gate/
    "elbv2.k8s.aws/pod-readiness-gate-inject" = "enabled"
    "loadbalancer/enabled"                    = var.loadbalancer_enabled ? "true" : "false"
    name                                      = var.namespace
    "monitoring/enabled"                      = var.monitoring_enabled ? "true" : "false"
  })
}

data "pf_kube_labels" "labels" {
  module = "kube_namespace"
}

######################### Namespace #######################################

resource "kubernetes_namespace" "main" {
  metadata {
    name   = var.namespace
    labels = merge(data.pf_kube_labels.labels.labels, local.extra_labels)
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
    labels    = data.pf_kube_labels.labels.labels
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
    labels    = data.pf_kube_labels.labels.labels
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
    labels    = data.pf_kube_labels.labels.labels
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
    labels    = data.pf_kube_labels.labels.labels
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
