locals {
  aws_secondary_default_tags = merge({
    app         = var.app
    environment = var.environment
    module      = var.module
      region      = var.region
      terraform   = "true"
      version     = var.version_tag
    }, 
    {
      region = var.aws_secondary_region
    }
  )
}

variable "aws_secondary_region" {
  description = "The AWS region code for the secondary provider."
  type        = string
}

variable "aws_secondary_account_id" {
  description = "The AWS account id for the secondary provider."
  type        = string
}

variable "aws_secondary_profile" {
  description = "The AWS profile to use for the secondary provider."
  type        = string
}

provider "aws" {
  alias               = "secondary"
  region              = var.aws_secondary_region
  allowed_account_ids = [var.aws_secondary_account_id]
  profile             = var.aws_secondary_profile
  default_tags {
    tags = local.aws_secondary_default_tags
  }
}
