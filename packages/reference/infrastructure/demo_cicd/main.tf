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
    aws = {
      source  = "hashicorp/aws"
      version = "5.70.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "3.25.0"
    }
    pf = {
      source = "panfactum/pf"
      version = "0.0.3"
    }
  }
}

data "aws_region" "current" {}

locals {
  namespace = module.namespace.namespace
  ci_image = "${module.pull_through.ecr_public_registry}/t8f0s7h5/panfactum:f06e9fd7ab80321190532a26a4b2ed9067a058a1"
}

module "pull_through" {
  source =   "${var.pf_module_source}aws_ecr_pull_through_cache_addresses${var.pf_module_ref}"
  pull_through_cache_enabled = true
}

module "namespace" {
  source =   "${var.pf_module_source}kube_namespace${var.pf_module_ref}"

  namespace = "cicd"
}
