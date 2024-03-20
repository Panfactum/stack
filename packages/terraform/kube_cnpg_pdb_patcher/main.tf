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
  namespace = module.namespace.namespace
}

module "kube_labels" {
  source         = "../kube_labels"
  environment    = var.environment
  pf_root_module = var.pf_root_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
}

module "constants" {
  source         = "../constants"
  environment    = var.environment
  pf_root_module = var.pf_root_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
}

/***************************************
* Namespace
***************************************/

module "namespace" {
  source         = "../kube_namespace"
  namespace      = var.namespace
  environment    = var.environment
  pf_root_module = var.pf_root_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
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

  environment    = var.environment
  pf_root_module = var.pf_root_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
}
