terraform {
  required_providers {
    pf = {
      source = "panfactum/pf"
      version = "0.0.3"
    }
  }
}

locals {
  namespace = module.namespace.namespace
}

module "pull_through" {
  source =   "${var.pf_module_source}aws_ecr_pull_through_cache_addresses${var.pf_module_ref}"
  pull_through_cache_enabled = true
}

module "namespace" {
  source =   "${var.pf_module_source}kube_namespace${var.pf_module_ref}"

  namespace = "cicd"
}