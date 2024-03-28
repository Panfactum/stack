terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.39.1"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

module "tags" {
  source         = "../aws_tags"
  environment    = var.environment
  region         = var.region
  pf_root_module = var.pf_root_module
  pf_module      = var.pf_module
  extra_tags     = var.extra_tags
  is_local       = var.is_local
}

resource "random_id" "lb_name" {
  byte_length = 8
  prefix      = var.name_prefix
}