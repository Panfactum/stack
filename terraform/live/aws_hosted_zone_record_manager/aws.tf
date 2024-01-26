locals {
  aws_default_tags = {
    app         = var.app
    environment = var.environment
    module      = var.module
    region      = var.region
    terraform   = "true"
    version     = var.version_tag
  }
}

variable "aws_region" {
  description = "The AWS region code for the provider."
  type        = string
}

variable "aws_account_id" {
  description = "The AWS account id for the provider."
  type        = string
}

variable "aws_profile" {
  description = "The AWS profile to use for the provider."
  type        = string
}

provider "aws" {
  region              = var.aws_region
  allowed_account_ids = [var.aws_account_id]
  profile             = var.aws_profile
  default_tags {
    tags = local.aws_default_tags
  }
  ignore_tags {
    key_prefixes = [ "kubernetes.io", "karpenter.sh" ]
  }
}
