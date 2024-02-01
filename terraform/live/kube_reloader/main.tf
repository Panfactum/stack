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
  service = "reloader"
}

module "kube_labels" {
  source = "../../modules/kube_labels"
  additional_labels = {
    service = local.service
  }
  app          = var.app
  environment  = var.environment
  module       = var.module
  region       = var.region
  version_tag  = var.version_tag
  version_hash = var.version_hash
  is_local     = var.is_local
}

module "constants" {
  source       = "../../modules/constants"
  app          = var.app
  environment  = var.environment
  module       = var.module
  region       = var.region
  version_tag  = var.version_tag
  version_hash = var.version_hash
  is_local     = var.is_local
}

module "namespace" {
  source            = "../../modules/kube_namespace"
  namespace         = local.service
  admin_groups      = ["system:admins"]
  reader_groups     = ["system:readers"]
  bot_reader_groups = ["system:bot-readers"]
  app               = var.app
  environment       = var.environment
  module            = var.module
  region            = var.region
  version_tag       = var.version_tag
  version_hash      = var.version_hash
  is_local          = var.is_local
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
  source              = "../../modules/kube_deployment"
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

  app          = var.app
  environment  = var.environment
  module       = var.module
  region       = var.region
  version_tag  = var.version_tag
  version_hash = var.version_hash
  is_local     = var.is_local
}
