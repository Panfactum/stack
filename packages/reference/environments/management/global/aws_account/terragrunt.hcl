include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

locals {
  secrets = yamldecode(sops_decrypt_file("${get_terragrunt_dir()}/secrets.yaml"))
}

inputs = {
  alias = "panfactum-${include.panfactum.locals.vars.environment}"

  contact_company_name       = "Panfactum, LLC"
  contact_website            = "https://panfactum.com"
  contact_full_name          = "Jack Langston"
  contact_address_line_1     = local.secrets.address_line_1
  contact_city               = local.secrets.city
  contact_district_or_county = local.secrets.district_or_county
  contact_state_or_region    = local.secrets.state_or_region
  contact_postal_code        = local.secrets.postal_code
  contact_country_code       = "US"
  contact_phone_number       = local.secrets.phone_number

  security_full_name     = "Jack Langston"
  security_title         = "Captain"
  security_phone_number  = local.secrets.phone_number
  security_email_address = local.secrets.email_address

  billing_full_name     = "Jack Langston"
  billing_title         = "Captain"
  billing_phone_number  = local.secrets.phone_number
  billing_email_address = local.secrets.email_address

  operations_full_name     = "Jack Langston"
  operations_title         = "Captain"
  operations_phone_number  = local.secrets.phone_number
  operations_email_address = local.secrets.email_address
}
