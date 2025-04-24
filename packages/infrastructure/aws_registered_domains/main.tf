// Live

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "5.80.0"
      configuration_aliases = [aws.global]
    }
    time = {
      source  = "hashicorp/time"
      version = "0.10.0"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.7"
    }
  }
}

data "pf_aws_tags" "tags" {
  module = "aws_registered_domains"
}

data "aws_region" "current" {}

##########################################################################
## Zone Setup
##########################################################################

resource "aws_route53_zone" "zones" {
  for_each = var.domain_names
  name     = each.key
  tags     = data.pf_aws_tags.tags.tags
}

##########################################################################
## Registered Domain Setup
##########################################################################

resource "aws_route53domains_registered_domain" "domain" {
  for_each = var.domain_names

  domain_name = each.key

  admin_privacy      = var.enable_privacy_protection
  registrant_privacy = var.enable_privacy_protection
  tech_privacy       = var.enable_privacy_protection
  transfer_lock      = var.enable_transfer_lock
  auto_renew         = var.enable_auto_renew

  dynamic "name_server" {
    for_each = toset(aws_route53_zone.zones[each.key].name_servers)
    content {
      name = name_server.key
    }
  }

  admin_contact {
    contact_type      = var.admin_contact.contact_type == "DEFAULT" ? (var.admin_contact.organization_name == null ? "PERSON" : "COMPANY") : var.admin_contact.contact_type
    organization_name = var.admin_contact.organization_name
    first_name        = var.admin_contact.first_name
    last_name         = var.admin_contact.last_name
    email             = var.admin_contact.email_address
    phone_number      = var.admin_contact.phone_number
    address_line_1    = var.admin_contact.address_line_1
    address_line_2    = var.admin_contact.address_line_2
    city              = var.admin_contact.city
    state             = var.admin_contact.state
    zip_code          = var.admin_contact.zip_code
    country_code      = var.admin_contact.country_code
  }

  tech_contact {
    contact_type      = var.tech_contact.contact_type == "DEFAULT" ? (var.tech_contact.organization_name == null ? "PERSON" : "COMPANY") : var.tech_contact.contact_type
    organization_name = var.tech_contact.organization_name
    first_name        = var.tech_contact.first_name
    last_name         = var.tech_contact.last_name
    email             = var.tech_contact.email_address
    phone_number      = var.tech_contact.phone_number
    address_line_1    = var.tech_contact.address_line_1
    address_line_2    = var.tech_contact.address_line_2
    city              = var.tech_contact.city
    state             = var.tech_contact.state
    zip_code          = var.tech_contact.zip_code
    country_code      = var.tech_contact.country_code
  }

  registrant_contact {
    contact_type      = var.registrant_contact.contact_type == "DEFAULT" ? (var.registrant_contact.organization_name == null ? "PERSON" : "COMPANY") : var.registrant_contact.contact_type
    organization_name = var.registrant_contact.organization_name
    first_name        = var.registrant_contact.first_name
    last_name         = var.registrant_contact.last_name
    email             = var.registrant_contact.email_address
    phone_number      = var.registrant_contact.phone_number
    address_line_1    = var.registrant_contact.address_line_1
    address_line_2    = var.registrant_contact.address_line_2
    city              = var.registrant_contact.city
    state             = var.registrant_contact.state
    zip_code          = var.registrant_contact.zip_code
    country_code      = var.registrant_contact.country_code
  }

  tags = data.pf_aws_tags.tags.tags
}


##########################################################################
## DNSSEC Setup
##########################################################################

// Because we are changing the ns records in the domain registration
// we need to wait a few seconds for that update to take effect
// to establish the parent-child zone relationship prior to trying
// to enable dnnsec
resource "time_sleep" "wait_for_ns_update" {
  depends_on      = [aws_route53domains_registered_domain.domain]
  create_duration = "120s"
  triggers        = { for domain, zone in aws_route53_zone.zones : domain => zone.zone_id }
}

module "dnssec" {
  source = "../aws_dnssec"
  providers = {
    aws.global = aws.global
  }

  hosted_zones = { for domain, zone in aws_route53_zone.zones : domain => zone.zone_id }

  depends_on = [time_sleep.wait_for_ns_update]
}


// It can take a few seconds for the new dnssec keys to be fully
// registered by the aws backend
resource "time_sleep" "wait_for_dnssec_update" {
  depends_on      = [module.dnssec]
  create_duration = "60s"
  triggers        = { for domain, zone in aws_route53_zone.zones : domain => zone.zone_id }
}

resource "aws_route53domains_delegation_signer_record" "dnssec" {
  for_each    = var.domain_names
  domain_name = each.key
  signing_attributes {
    algorithm  = module.dnssec.keys[each.key].algorithm
    flags      = module.dnssec.keys[each.key].flags
    public_key = module.dnssec.keys[each.key].public_key
  }

  depends_on = [time_sleep.wait_for_dnssec_update]
}

##########################################################################
## IAM Role for Record Management
##########################################################################

module "iam_role" {
  source = "../aws_dns_iam_role"

  hosted_zone_ids                           = [for zone, config in aws_route53_zone.zones : config.zone_id]
  additional_account_ids_with_record_access = var.additional_account_ids_with_record_access
}

