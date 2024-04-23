include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

inputs = {
  state_bucket = include.panfactum.locals.vars.tf_state_bucket
  lock_table   = include.panfactum.locals.vars.tf_state_lock_table
}
