include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = "../../../../../terraform//aws_ses_domain"
  #source = "github.com/Panfactum/stack.git?ref=main/packages/terraform//aws_ses_domain"
}


inputs = {
  domain             = "panfactum.com"
  dmarc_report_email = "security@panfactum.com"
}
