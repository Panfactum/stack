include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = "../../../../../terraform//aws_kms_encrypt_key"
  #source = "github.com/Panfactum/stack.git?ref=main/packages/terraform//aws_kms_encrypt_key"
}

inputs = {
  name        = "sops-${include.panfactum.locals.vars.environment}"
  description = "Encryption key for sops"
}
