terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.22"
    }
  }
}

module "constants" {
  source = "../../modules/constants"
}

resource "kubernetes_priority_class" "database" {
  metadata {
    name   = module.constants.database_priority_class_name
    labels = var.kube_labels
  }
  description = "Used for running database containers"
  value       = 10000000
}

resource "kubernetes_priority_class" "default" {
  metadata {
    name   = module.constants.default_priority_class_name
    labels = var.kube_labels
  }
  value          = 0
  global_default = true
}

resource "kubernetes_priority_class" "cluster_important" {
  metadata {
    name   = module.constants.cluster_important_priority_class_name
    labels = var.kube_labels
  }
  description = "Used for important global cluster utilities that are not necessary for cluster bootstrapping"
  value       = 100000000
}
