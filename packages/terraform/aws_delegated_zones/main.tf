// Live

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "5.39.1"
      configuration_aliases = [aws.secondary]
    }
  }
}

locals {
  subdomains = toset(flatten([for root in var.root_domain_names : [for sub in var.subdomain_identifiers : "${sub}.${root}"]]))
}


##########################################################################
## Zone Setup
##########################################################################

resource "aws_route53_delegation_set" "zones" {
  for_each       = local.subdomains
  reference_name = each.key
}

resource "aws_route53_zone" "zones" {
  for_each          = local.subdomains
  name              = each.key
  delegation_set_id = aws_route53_delegation_set.zones[each.key].id
}

##########################################################################
## IAM Role for Record Management
##########################################################################

module "iam_role" {
  source = "../aws_dns_iam_role"

  domain_names = local.subdomains
  environment  = var.environment
  module       = var.module
  region       = var.region
  version_tag  = var.version_tag
  version_hash = var.version_hash
  is_local     = var.is_local
}

##########################################################################
## DNSSEC Setup
##########################################################################

module "dnssec" {
  source = "../aws_dnssec"
  providers = {
    aws.global = aws.global
  }

  domain_names = local.subdomains
  environment  = var.environment
  module       = var.module
  region       = var.region
  version_tag  = var.version_tag
  version_hash = var.version_hash
  is_local     = var.is_local

  depends_on = [aws_route53_zone.zones]
}

##########################################################################
## Root Zone Records
##########################################################################

data "aws_route53_zone" "roots" {
  provider = aws.secondary
  for_each = var.root_domain_names
  name     = each.key
}

// Subdomain delegation
resource "aws_route53_record" "ns" {
  provider = aws.secondary
  for_each = local.subdomains
  name     = split(".", each.key)[0]
  type     = "NS"
  zone_id  = data.aws_route53_zone.roots[join(".", slice(split(".", each.key), 1, length(split(".", each.key))))].id
  ttl      = 60 * 60 * 24 * 2
  records  = aws_route53_delegation_set.zones[each.key].name_servers
}

// DNSSEC delegation
resource "aws_route53_record" "ds" {
  provider = aws.secondary
  for_each = local.subdomains
  name     = split(".", each.key)[0]
  type     = "DS"
  zone_id  = data.aws_route53_zone.roots[join(".", slice(split(".", each.key), 1, length(split(".", each.key))))].id
  ttl      = 60 * 60 * 24 * 2
  records  = [module.dnssec.keys[each.key].ds_record]
}