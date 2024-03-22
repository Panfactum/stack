// Live

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "5.39.1"
      configuration_aliases = [aws.global]
    }
  }
}

module "tags" {
  source         = "../aws_tags"
  environment    = var.environment
  region         = var.region
  pf_root_module = var.pf_root_module
  pf_module      = var.pf_module
  extra_tags     = var.extra_tags
  is_local       = var.is_local
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
  tags = merge(
    module.tags.tags,
    {
      # "panfactum.com/record-manager-arn" = module.iam_role.role_arn
    }
  )
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
    for_each = toset(aws_route53_delegation_set.zones[each.key].name_servers)
    content {
      name = name_server.key
    }
  }

  admin_contact {
    organization_name = var.admin_organization_name
    first_name        = var.admin_first_name
    last_name         = var.admin_last_name
    email             = var.admin_email_address
    phone_number      = var.admin_phone_number
    address_line_1    = var.admin_address_line_1
    address_line_2    = var.admin_address_line_2
    city              = var.admin_city
    state             = var.admin_state
    zip_code          = var.admin_zip_code
    country_code      = var.admin_country_code
  }

  tech_contact {
    organization_name = var.tech_organization_name
    first_name        = var.tech_first_name
    last_name         = var.tech_last_name
    email             = var.tech_email_address
    phone_number      = var.tech_phone_number
    address_line_1    = var.tech_address_line_1
    address_line_2    = var.tech_address_line_2
    city              = var.tech_city
    state             = var.tech_state
    zip_code          = var.tech_zip_code
    country_code      = var.tech_country_code
  }

  registrant_contact {
    organization_name = var.registrant_organization_name
    first_name        = var.registrant_first_name
    last_name         = var.registrant_last_name
    email             = var.registrant_email_address
    phone_number      = var.registrant_phone_number
    address_line_1    = var.registrant_address_line_1
    address_line_2    = var.registrant_address_line_2
    city              = var.registrant_city
    state             = var.registrant_state
    zip_code          = var.registrant_zip_code
    country_code      = var.registrant_country_code
  }

  tags = module.tags.tags
}


##########################################################################
## DNSSEC Setup
##########################################################################

module "dnssec" {
  source = "../aws_dnssec"
  providers = {
    aws.global = aws.global
  }

  hosted_zone_names = var.domain_names
  environment       = var.environment
  pf_root_module    = var.pf_root_module
  region            = var.region
  is_local          = var.is_local
  extra_tags        = var.extra_tags

  depends_on = [aws_route53_zone.zones]
}

resource "aws_route53domains_delegation_signer_record" "dnssec" {
  for_each    = var.domain_names
  domain_name = each.key
  signing_attributes {
    algorithm  = module.dnssec.keys[aws_route53_zone.zones[each.key].zone_id].algorithm
    flags      = module.dnssec.keys[aws_route53_zone.zones[each.key].zone_id].flags
    public_key = module.dnssec.keys[aws_route53_zone.zones[each.key].zone_id].public_key
  }
}

##########################################################################
## IAM Role for Record Management
##########################################################################

module "iam_role" {
  source = "../aws_dns_iam_role"

  domain_names                              = var.domain_names
  additional_account_ids_with_record_access = var.additional_account_ids_with_record_access
  environment                               = var.environment
  pf_root_module                            = var.pf_root_module
  region                                    = var.region
  is_local                                  = var.is_local
  extra_tags                                = var.extra_tags

  depends_on = [aws_route53_zone.zones]
}