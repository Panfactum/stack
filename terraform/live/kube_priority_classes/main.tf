// Live

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.22"
    }
  }
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

module "constants" {
  source = "../../modules/constants"
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

resource "kubernetes_priority_class" "database" {
  metadata {
    name   = module.constants.database_priority_class_name
    labels = module.kube_labels.kube_labels
  }
  description = "Used for running database containers"
  value       = 10000000
}

resource "kubernetes_priority_class" "default" {
  metadata {
    name   = module.constants.default_priority_class_name
    labels = module.kube_labels.kube_labels
  }
  value          = 0
  global_default = true
}

resource "kubernetes_priority_class" "cluster_important" {
  metadata {
    name   = module.constants.cluster_important_priority_class_name
    labels = module.kube_labels.kube_labels
  }
  description = "Used for important global cluster utilities that are not necessary for cluster bootstrapping"
  value       = 100000000
}
