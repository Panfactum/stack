terraform {
  required_providers {}
}

locals {
  kube_labels = merge(var.extra_tags, {
    "panfactum.com/root-module" = var.pf_root_module,
    "panfactum.com/module"      = var.pf_module,
    "panfactum.com/environment" = var.environment,
    "panfactum.com/region"      = var.region,
    "panfactum.com/local" : var.is_local
    environment = var.environment,
    region      = var.region,
    terraform   = "true"
  })
}