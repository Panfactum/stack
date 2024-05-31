terraform {
  required_providers {}
}

locals {
  # Note there are 3 replaces for key and values b/c they must start and end with an alpha-numeric character
  sanitized_labels = {
    for k, v in var.extra_tags : replace(replace(replace(k, "/[^-a-zA-Z0-9_./]/", "."), "/^[^a-zA-Z0-9](.*)/", "$1"), "/(.*)[^a-zA-Z0-9]$/", "$1") => replace(replace(replace(v, "/[^-a-zA-Z0-9_.]/", "."), "/^[^a-zA-Z0-9](.*)/", "$1"), "/(.*)[^a-zA-Z0-9]$/", "$1")
  }

  kube_labels = merge(local.sanitized_labels, {
    "panfactum.com/root-module"   = var.pf_root_module,
    "panfactum.com/module"        = var.pf_module,
    "panfactum.com/environment"   = var.environment,
    "panfactum.com/region"        = var.region,
    "panfactum.com/local"         = var.is_local ? "true" : "false"
    "panfactum.com/stack-version" = var.pf_stack_version
    "panfactum.com/stack-commit"  = var.pf_stack_commit
  })
}
