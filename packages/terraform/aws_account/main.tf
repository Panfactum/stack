// Live

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.39.1"
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

###########################################################################
## Alias
###########################################################################

resource "aws_iam_account_alias" "alias" {
  account_alias = var.alias
}

###########################################################################
## Contact Information
###########################################################################

resource "aws_account_primary_contact" "primary" {
  address_line_1     = var.contact_address_line_1
  address_line_2     = var.contact_address_line_2
  city               = var.contact_city
  company_name       = var.contact_company_name
  country_code       = var.contact_country_code
  district_or_county = var.contact_district_or_county
  full_name          = var.contact_full_name
  phone_number       = var.contact_phone_number
  postal_code        = var.contact_postal_code
  state_or_region    = var.contact_state_or_region
  website_url        = var.contact_website_url
}

resource "aws_account_alternate_contact" "security" {
  alternate_contact_type = "SECURITY"
  email_address          = var.security_email_address
  name                   = var.security_full_name
  phone_number           = var.security_phone_number
  title                  = var.security_title
}

resource "aws_account_alternate_contact" "operations" {
  alternate_contact_type = "OPERATIONS"
  email_address          = var.operations_email_address
  name                   = var.operations_full_name
  phone_number           = var.operations_phone_number
  title                  = var.operations_title
}

resource "aws_account_alternate_contact" "billing" {
  alternate_contact_type = "BILLING"
  email_address          = var.billing_email_address
  name                   = var.billing_full_name
  phone_number           = var.billing_phone_number
  title                  = var.billing_title
}


###########################################################################
## Create the service linked role for working with spot instances
###########################################################################

resource "aws_iam_service_linked_role" "spot" {
  aws_service_name = "spot.amazonaws.com"
  description      = "Used by various controllers to launch spot instances"
  tags             = module.tags.tags
}