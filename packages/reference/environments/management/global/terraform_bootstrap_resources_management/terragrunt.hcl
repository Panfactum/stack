include "panfactum" {
  path = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = "../../../../../terraform//terraform_bootstrap_resources"
  #source = "github.com/Panfactum/stack.git?ref=main/packages/terraform//terraform_bootstrap_resources"
}

inputs = {
  state_bucket = include.panfactum.locals.vars.tf_state_bucket
  lock_table   = include.panfactum.locals.vars.tf_state_bucket
}
