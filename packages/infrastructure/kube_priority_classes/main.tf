terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
  }
}

module "util" {
  source = "../kube_workload_utility"

  # pf-generate: set_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}

module "constants" {
  source = "../kube_constants"

  # pf-generate: set_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}

resource "kubernetes_priority_class" "workload_important" {
  metadata {
    name   = module.constants.workload_important_priority_class_name
    labels = module.util.labels
  }
  description = "A Kubernetes Priority Class that is higher than the default but lower than cluster-important. Generally, all stateful systems should have this priority class."
  value       = 10000000
}

resource "kubernetes_priority_class" "default" {
  metadata {
    name   = module.constants.default_priority_class_name
    labels = module.util.labels
  }
  value          = 0
  global_default = true
}

resource "kubernetes_priority_class" "cluster_important" {
  metadata {
    name   = module.constants.cluster_important_priority_class_name
    labels = module.util.labels
  }
  description = "Used for important global cluster utilities that are not necessary for cluster bootstrapping"
  value       = 100000000
}

resource "kubernetes_priority_class" "extra" {
  for_each = var.extra_priority_classes
  metadata {
    name   = each.key
    labels = module.util.labels
  }
  value = each.value
}
