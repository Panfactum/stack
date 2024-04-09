terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.39.1"
    }
  }
}

module "tags" {
  source = "../aws_tags"

  pf_stack_edition = var.pf_stack_edition
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  extra_tags       = var.extra_tags
  is_local         = var.is_local
}

/***************************************
* Set Up Log Group
***************************************/
resource "aws_cloudwatch_log_group" "main" {
  name              = var.name
  retention_in_days = 1                   // We don't need to retain these long-term as they should be stored somewhere cheaper long-term
  log_group_class   = "INFREQUENT_ACCESS" // Cuts costs by 50% and we don't query directly from cloudwatch
  tags = merge(module.tags.tags, {
    description = var.description
  })
}

/***************************************
* Todo: Log exporter
***************************************/
