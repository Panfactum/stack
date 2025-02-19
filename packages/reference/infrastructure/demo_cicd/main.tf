terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
    }
    kubectl = {
      source  = "alekc/kubectl"
    }
    aws = {
      source  = "hashicorp/aws"
    }
    random = {
      source  = "hashicorp/random"
    }
    vault = {
      source  = "hashicorp/vault"
    }
    pf = {
      source = "panfactum/pf"
    }
  }
}

locals {
  namespace = module.namespace.namespace
  ci_image = "${module.pull_through.ecr_public_registry}/${module.constants.panfactum_image_repository}:${module.constants.panfactum_image_tag}"
}

module "pull_through" {
  source =   "${var.pf_module_source}aws_ecr_pull_through_cache_addresses${var.pf_module_ref}"
  pull_through_cache_enabled = true
}

module "constants" {
  source = "${var.pf_module_source}kube_constants${var.pf_module_ref}"
}

module "namespace" {
  source =   "${var.pf_module_source}kube_namespace${var.pf_module_ref}"

  namespace = "cicd"
}
