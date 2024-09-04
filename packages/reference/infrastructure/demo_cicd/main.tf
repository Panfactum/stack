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
      version = "5.39.1"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "3.25.0"
    }
  }
}

data "aws_region" "current" {}

locals {
  namespace = module.namespace.namespace
  ci_image = "${module.pull_through.ecr_public_registry}/t8f0s7h5/panfactum:f06e9fd7ab80321190532a26a4b2ed9067a058a1"
}

module "pull_through" {
  source =   "github.com/Panfactum/stack.git//packages/infrastructure/aws_ecr_pull_through_cache_addresses?ref=c61f7564067d148447fb8cfb1c8d8e2b5a91de4d" # pf-update
  pull_through_cache_enabled = true
}

module "namespace" {
  source =   "github.com/Panfactum/stack.git//packages/infrastructure/kube_namespace?ref=c61f7564067d148447fb8cfb1c8d8e2b5a91de4d" # pf-update

  namespace = "cicd"

  # pf-generate: pass_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}
