// Live

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
  }
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
