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

data "pf_aws_tags" "tags" {
  module = "aws_account"
}

data "aws_region" "current" {}

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
  count              = var.primary_contact != null ? 1 : 0
  address_line_1     = var.primary_contact.address_line_1
  address_line_2     = var.primary_contact.address_line_2
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

resource "aws_account_alternate_contact" "security" {
  count                  = var.security_contact != null ? 1 : 0
  alternate_contact_type = "SECURITY"
  email_address          = var.security_contact.email_address
  name                   = var.security_contact.full_name
  phone_number           = var.security_contact.phone_number
  title                  = var.security_contact.title
}

resource "aws_account_alternate_contact" "operations" {
  count                  = var.operations_contact != null ? 1 : 0
  alternate_contact_type = "OPERATIONS"
  email_address          = var.operations_contact.email_address
  name                   = var.operations_contact.full_name
  phone_number           = var.operations_contact.phone_number
  title                  = var.operations_contact.title
}

resource "aws_account_alternate_contact" "billing" {
  count                  = var.billing_contact != null ? 1 : 0
  alternate_contact_type = "BILLING"
  email_address          = var.billing_contact.email_address
  name                   = var.billing_contact.full_name
  phone_number           = var.billing_contact.phone_number
  title                  = var.billing_contact.title
}


###########################################################################
## Create the service linked role for working with spot instances
###########################################################################

resource "aws_iam_service_linked_role" "spot" {
  aws_service_name = "spot.amazonaws.com"
  description      = "Used by various controllers to launch spot instances"
  tags             = data.pf_aws_tags.tags.tags
}

/***************************************
* Spot Data Feed
* https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/spot-data-feeds.html
***************************************/

resource "random_id" "spot_data_feed_bucket_name" {
  byte_length = 8
  prefix      = "spot-data-"
}

module "data_feed_bucket" {
  source      = "../aws_s3_private_bucket"
  bucket_name = random_id.spot_data_feed_bucket_name.hex
  description = "Spot instance data feed"

  expire_after_days               = 7
  expire_old_versions             = true
  intelligent_transitions_enabled = false
  acl_enabled                     = true
}

resource "aws_spot_datafeed_subscription" "feed" {
  bucket     = module.data_feed_bucket.bucket_name
  depends_on = [module.data_feed_bucket]
}
