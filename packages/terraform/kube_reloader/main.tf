// Live

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
  }
}

locals {
  service = "reloader"
}

module "kube_labels" {
  source         = "../kube_labels"
  environment    = var.environment
  pf_root_module = var.pf_root_module
  pf_module      = var.pf_module
  region         = var.region
  is_local       = var.is_local
  extra_tags = merge(var.extra_tags, {
    service = local.service
  })
}

module "constants" {
  source         = "../constants"
  environment    = var.environment
  pf_root_module = var.pf_root_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
}

module "namespace" {
  source         = "../kube_namespace"
  namespace      = local.service
  environment    = var.environment
  pf_root_module = var.pf_root_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
}

resource "kubernetes_cluster_role" "reloader" {
  metadata {
    labels = module.kube_labels.kube_labels
    name   = local.service
  }
  rule {
    api_groups = [""]
    resources  = ["secrets", "configmaps"]
    verbs      = ["list", "get", "watch"]
  }
  rule {
    api_groups = ["apps"]
    resources  = ["deployments", "daemonsets", "statefulsets"]
    verbs      = ["list", "get", "update", "patch"]
  }
  rule {
    api_groups = ["extensions"]
    resources  = ["deployments", "daemonsets"]
    verbs      = ["list", "get", "update", "patch"]
  }
  rule {
    api_groups = [""]
    resources  = ["events"]
    verbs      = ["create", "patch"]
  }
}

resource "kubernetes_cluster_role_binding" "reloader" {
  metadata {
    labels = module.kube_labels.kube_labels
    name   = local.service
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.reloader.metadata[0].name
  }
  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.reloader.metadata[0].name
    namespace = local.service
  }
}

resource "kubernetes_role" "reloader" {
  metadata {
    labels    = module.kube_labels.kube_labels
    name      = local.service
    namespace = module.namespace.namespace
  }
  rule {
    api_groups = ["coordination.k8s.io"]
    resources  = ["leases"]
    verbs      = ["list", "get", "watch", "update", "patch", "create"]
  }
}

resource "kubernetes_role_binding" "reloader" {
  metadata {
    labels    = module.kube_labels.kube_labels
    name      = local.service
    namespace = module.namespace.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.reloader.metadata[0].name
  }
  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.reloader.metadata[0].name
    namespace = module.namespace.namespace
  }
}

resource "kubernetes_service_account" "reloader" {
  metadata {
    name      = local.service
    namespace = module.namespace.namespace
  }
}
// TODO: Need to switch to helm chart for HA
module "deployment" {
  source              = "../kube_deployment"
  namespace           = module.namespace.namespace
  service_name        = local.service
  service_account     = kubernetes_service_account.reloader.metadata[0].name
  priority_class_name = module.constants.cluster_important_priority_class_name

  // does not need to be highly available
  min_replicas = 1
  max_replicas = 1
  node_preferences = {
    "node.kubernetes.io/class" = {
      operator = "In"
      values   = ["controller"]
      weight   = 100
    }
  }

  containers = [
    {
      name = "reloader"
      command = [
        "/manager",
        "--reload-strategy=annotations",
        "--enable-ha=true",
        "--log-format=JSON"
      ]
      image             = "stakater/reloader"
      version           = var.reloader_version
      healthcheck_type  = "HTTP"
      healthcheck_route = "/metrics"
      healthcheck_port  = 9090
    }
  ]

  ports = {
    http = {
      service_port = 9090
      pod_port     = 9090
    }
  }

  vpa_enabled = var.vpa_enabled

  environment    = var.environment
  pf_root_module = var.pf_root_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
}
