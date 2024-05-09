include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

inputs = {
  account_access_configuration = {
    management = {
      account_id       = "143003111016"
      superuser_groups = ["superusers"]
      restricted_reader_groups = [
        "privileged_engineers",
        "engineers"
      ]
      billing_admin_groups = ["billing_admins"]
    }
    production = {
      account_id               = "891377197483"
      superuser_groups         = ["superusers"]
      admin_groups             = ["privileged_engineers"]
      reader_groups            = ["engineers"]
      restricted_reader_groups = ["restricted_engineers", "demo_users"]
      billing_admin_groups     = ["billing_admins"]
    }
    development = {
      account_id = "471112902605"
      superuser_groups = [
        "superusers",
        "privileged_engineers",
        "engineers"
      ]
      admin_groups = [
        "restricted_engineers"
      ]
      billing_admin_groups = ["billing_admins"]
    }
  }
}
