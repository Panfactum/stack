terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.22"
    }
  }
}

locals {
  namespace = module.namespace.namespace
}

module "kube_labels" {
  source = "../kube_labels"
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

module "constants" {
  source = "../constants"
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

/***************************************
* Namespace
***************************************/

module "namespace" {
  source            = "../kube_namespace"
  namespace         = var.namespace
  admin_groups      = ["system:admins"]
  reader_groups     = ["system:readers"]
  bot_reader_groups = ["system:bot-readers"]
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

/***************************************
* Deployment
***************************************/

resource "kubernetes_service_account" "main" {
  metadata {
    name      = local.namespace
    namespace = local.namespace
    labels    = module.kube_labels.kube_labels
  }
}

resource "kubernetes_cluster_role" "main" {
  metadata {
    name   = var.namespace
    labels = module.kube_labels.kube_labels
  }
  rule {
    api_groups = ["policy/v1"]
    resources  = ["PodDisruptionBudget"]
    verbs      = ["*"]
  }
}

resource "kubernetes_cluster_role_binding" "main" {
  metadata {
    name   = var.namespace
    labels = module.kube_labels.kube_labels
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.main.metadata[0].name
  }
  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.main.metadata[0].name
    namespace = local.namespace
  }
}

module "cronjob" {
  source = "../kube_cronjob"

  namespace       = local.namespace
  name            = local.namespace
  schedule        = var.schedule
  timeout_seconds = 120
  service_account = kubernetes_service_account.main.metadata[0].name
  containers = [
    {
      name           = "patcher"
      image          = var.image_repo
      version        = var.image_version
      uid            = module.constants.ci_uid
      minimum_memory = 250
      minimum_cpu    = 100
      command = [
        "/usr/bin/bash",
        "-c",
        ". /home/runner/.profile; linkerd-await -S cnpg-pdb-patch"
      ]
    }
  ]

  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}
