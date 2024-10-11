// Live

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "5.70.0"
      configuration_aliases = [aws.secondary]
    }
    time = {
      source  = "hashicorp/time"
      version = "0.10.0"
    }
  }
}

module "tags" {
  source = "../aws_tags"

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

##########################################################################
## Zone Setup
##########################################################################

resource "aws_route53_delegation_set" "zones" {
  for_each       = var.domain_names
  reference_name = each.key
}

resource "aws_route53_zone" "zones" {
  for_each          = var.domain_names
  name              = each.key
  delegation_set_id = aws_route53_delegation_set.zones[each.key].id
  tags              = module.tags.tags
}

##########################################################################
## IAM Role for Record Management
##########################################################################

module "iam_role" {
  source = "../aws_dns_iam_role"

  hosted_zone_ids = [for zone, config in aws_route53_zone.zones : config.zone_id]

  # pf-generate: pass_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate

  depends_on = [aws_route53_zone.zones]
}

##########################################################################
## DNSSEC Setup
##########################################################################

module "dnssec" {
  count  = var.dnssec_enabled ? 1 : 0
  source = "../aws_dnssec"
  providers = {
    aws.global = aws.global
  }

  hosted_zones = { for domain, zone in aws_route53_zone.zones : domain => zone.zone_id }

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