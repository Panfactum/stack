// Live

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "5.80.0"
      configuration_aliases = [aws.secondary]
    }
    time = {
      source  = "hashicorp/time"
      version = "0.10.0"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.3"
    }
  }
}

data "pf_aws_tags" "tags" {
  module = "aws_dns_zones"
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
  tags              = data.pf_aws_tags.tags.tags
}

##########################################################################
## IAM Role for Record Management
##########################################################################

module "iam_role" {
  source = "../aws_dns_iam_role"

  hosted_zone_ids = [for zone, config in aws_route53_zone.zones : config.zone_id]

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
}