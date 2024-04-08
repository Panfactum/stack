include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}


inputs = {
  domain             = "panfactum.com"
  dmarc_report_email = "security@panfactum.com"
}
