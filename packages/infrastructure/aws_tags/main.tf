terraform {
  required_providers {}
}

locals {
  sanitized_tags = {
    for k, v in var.extra_tags : replace(k, "/[^\\p{L}\\p{Z}\\p{N}_.:/=+\\-@]/", ".") => replace(v, "/[^\\p{L}\\p{Z}\\p{N}_.:/=+\\-@]/", ".")
  }

  aws_tags = merge(local.sanitized_tags, {
    "panfactum.com/environment"   = var.environment
    "panfactum.com/region"        = var.region
    "panfactum.com/root-module"   = var.pf_root_module
    "panfactum.com/module"        = var.pf_module
    "panfactum.com/local"         = var.is_local ? "true" : "false",
    "panfactum.com/stack-version" = var.pf_stack_version
    "panfactum.com/stack-commit"  = var.pf_stack_commit
  })
}
