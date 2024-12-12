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

data "pf_kube_labels" "labels" {
  module = "kube_priority_classes"
}

module "constants" {
  source = "../kube_constants"
}

resource "kubernetes_priority_class" "workload_important" {
  metadata {
    name   = module.constants.workload_important_priority_class_name
    labels = data.pf_kube_labels.labels.labels
  }
  description = "A Kubernetes Priority Class that is higher than the default but lower than cluster-important. Generally, all stateful systems should have this priority class."
  value       = 10000000
}

resource "kubernetes_priority_class" "default" {
  metadata {
    name   = module.constants.default_priority_class_name
    labels = data.pf_kube_labels.labels.labels
  }
  value          = 0
  global_default = true
}

resource "kubernetes_priority_class" "cluster_important" {
  metadata {
    name   = module.constants.cluster_important_priority_class_name
    labels = data.pf_kube_labels.labels.labels
  }
  description = "Used for important global cluster utilities that are not necessary for cluster bootstrapping"
  value       = 100000000
}

resource "kubernetes_priority_class" "extra" {
  for_each = var.extra_priority_classes
  metadata {
    name   = each.key
    labels = data.pf_kube_labels.labels.labels
  }
  value = each.value
}
