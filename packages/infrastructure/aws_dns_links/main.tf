// Live

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.80.0"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.7"
    }
  }
}


locals {
  subdomains_raw = flatten([for ancestor, descendents in var.links : [for config in descendents : merge(config, {
    id       = "${config.subdomain}.${ancestor}"
    ancestor = ancestor
  })]])
  subdomains = { for config in local.subdomains_raw : config.id => config }
}
##########################################################################
## Zone Fetching
##########################################################################

data "aws_route53_zone" "ancestors" {
  for_each = var.links
  name     = each.key
}

##########################################################################
## Ancestor Zone Records
##########################################################################

// Subdomain delegation
resource "aws_route53_record" "ns" {
  for_each = local.subdomains
  name     = each.value.subdomain
  type     = "NS"
  zone_id  = data.aws_route53_zone.ancestors[each.value.ancestor].id
  ttl      = 60 * 60 * 24 * 2
  records  = each.value.name_servers
}

// DNSSEC delegation
resource "aws_route53_record" "ds" {
  provider = aws.secondary
  for_each = local.subdomains
  name     = each.value.subdomain
  type     = "DS"
  zone_id  = data.aws_route53_zone.ancestors[each.value.ancestor].id
  ttl      = 60 * 60 * 24 * 2
  records  = [each.value.ds_record]
}
