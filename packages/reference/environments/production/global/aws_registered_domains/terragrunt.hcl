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
  domain_names = [
    "panfactum.com",
    "getpanfactum.com",
    "trypanfactum.com"
  ]

  admin_organization_name = "Panfactum"
  admin_first_name        = "Jack"
  admin_last_name         = "Langston"
  admin_email_address     = local.secrets.email_address
  admin_phone_number      = local.secrets.phone_number
  admin_address_line_1    = local.secrets.address_line_1
  admin_city              = local.secrets.city
  admin_state             = local.secrets.state
  admin_zip_code          = local.secrets.postal_code
  admin_country_code      = "US"

  registrant_organization_name = "Panfactum"
  registrant_first_name        = "Jack"
  registrant_last_name         = "Langston"
  registrant_email_address     = local.secrets.email_address
  registrant_phone_number      = local.secrets.phone_number
  registrant_address_line_1    = local.secrets.address_line_1
  registrant_city              = local.secrets.city
  registrant_state             = local.secrets.state
  registrant_zip_code          = local.secrets.postal_code
  registrant_country_code      = "US"

  tech_organization_name = "Panfactum"
  tech_first_name        = "Jack"
  tech_last_name         = "Langston"
  tech_email_address     = local.secrets.email_address
  tech_phone_number      = local.secrets.phone_number
  tech_address_line_1    = local.secrets.address_line_1
  tech_city              = local.secrets.city
  tech_state             = local.secrets.state
  tech_zip_code          = local.secrets.postal_code
  tech_country_code      = "US"
}
