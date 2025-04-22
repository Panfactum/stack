// Live

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "5.80.0"
      configuration_aliases = [aws.global]
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.7"
    }
  }
}

data "pf_aws_tags" "tags" {
  module = "aws_account"
}

data "aws_region" "current" {}


###########################################################################
## Organization
###########################################################################

resource "aws_organizations_organization" "org" {
  feature_set = "ALL"
  aws_service_access_principals = tolist(toset(concat([
    "iam.amazonaws.com",
    "account.amazonaws.com",
    "config.amazonaws.com",
    "sso.amazonaws.com",
    "compute-optimizer.amazonaws.com",
    "cost-optimization-hub.bcm.amazonaws.com",
    "servicequotas.amazonaws.com"
  ], var.extra_aws_service_access_principals)))
}

// Enables https://docs.aws.amazon.com/IAM/latest/UserGuide/id_root-enable-root-access.html
resource "aws_iam_organizations_features" "org" {
  enabled_features = [
    "RootCredentialsManagement",
    "RootSessions"
  ]
}

###########################################################################
## Accounts
###########################################################################

resource "aws_organizations_account" "accounts" {
  for_each                   = var.accounts
  name                       = each.value.name
  email                      = each.value.email
  close_on_deletion          = each.value.close_on_deletion
  iam_user_access_to_billing = "ALLOW"
  tags                       = data.pf_aws_tags.tags.tags
}

###########################################################################
## Contact Information
###########################################################################

resource "aws_account_primary_contact" "management" {
  address_line_1     = var.primary_contact.address_line_1
  address_line_2     = var.primary_contact.address_line_2
  address_line_3     = var.primary_contact.address_line_3
  city               = var.primary_contact.city
  company_name       = var.primary_contact.company_name
  country_code       = var.primary_contact.country_code
  district_or_county = var.primary_contact.district_or_county
  full_name          = var.primary_contact.full_name
  phone_number       = var.primary_contact.phone_number
  postal_code        = var.primary_contact.postal_code
  state_or_region    = var.primary_contact.state_or_region
  website_url        = var.primary_contact.website_url
}

resource "aws_account_alternate_contact" "management" {
  for_each               = { for k, v in var.alternate_contacts : k => v if v != null }
  alternate_contact_type = upper(each.key)
  email_address          = each.value.email_address
  name                   = each.value.full_name
  phone_number           = each.value.phone_number
  title                  = each.value.title
}

resource "aws_account_primary_contact" "sub" {
  for_each           = aws_organizations_account.accounts
  account_id         = each.value.id
  address_line_1     = var.primary_contact.address_line_1
  address_line_2     = var.primary_contact.address_line_2
  address_line_3     = var.primary_contact.address_line_3
  city               = var.primary_contact.city
  company_name       = var.primary_contact.company_name
  country_code       = var.primary_contact.country_code
  district_or_county = var.primary_contact.district_or_county
  full_name          = var.primary_contact.full_name
  phone_number       = var.primary_contact.phone_number
  postal_code        = var.primary_contact.postal_code
  state_or_region    = var.primary_contact.state_or_region
  website_url        = var.primary_contact.website_url

  depends_on = [aws_organizations_organization.org]
}

locals {
  alternate_contacts_list = flatten([for name, config in aws_organizations_account.accounts : [for type in ["security", "billing", "operations"] : {
    type          = type
    name          = name
    account_id    = config.id
    email_address = lookup(var.accounts[name].alternate_contacts, type) == null ? lookup(var.alternate_contacts, type).email_address : lookup(var.accounts[name].alternate_contacts, type).email_address
    full_name     = lookup(var.accounts[name].alternate_contacts, type) == null ? lookup(var.alternate_contacts, type).full_name : lookup(var.accounts[name].alternate_contacts, type).full_name
    phone_number  = lookup(var.accounts[name].alternate_contacts, type) == null ? lookup(var.alternate_contacts, type).phone_number : lookup(var.accounts[name].alternate_contacts, type).phone_number
    title         = lookup(var.accounts[name].alternate_contacts, type) == null ? lookup(var.alternate_contacts, type).title : lookup(var.accounts[name].alternate_contacts, type).title
  } if lookup(var.alternate_contacts, type, null) != null || lookup(var.accounts[name].alternate_contacts, type, null) != null]])
  alternate_contacts = { for config in local.alternate_contacts_list : "${config.name}-${config.type}" => config }
}

resource "aws_account_alternate_contact" "sub" {
  for_each               = local.alternate_contacts
  account_id             = each.value.account_id
  alternate_contact_type = upper(each.value.type)
  email_address          = each.value.email_address
  name                   = each.value.full_name
  phone_number           = each.value.phone_number
  title                  = each.value.title

  depends_on = [aws_organizations_organization.org]
}
