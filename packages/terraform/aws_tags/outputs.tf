output "tags" {
  value = merge(var.extra_tags, {
    environment                   = var.environment
    region                        = var.region
    "panfactum.com/environment"   = var.environment
    "panfactum.com/region"        = var.region
    "panfactum.com/root-module"   = var.pf_root_module
    "panfactum.com/module"        = var.pf_module
    "panfactum.com/local"         = var.is_local ? "true" : "false",
    "panfactum.com/stack-edition" = var.pf_stack_edition
    "panfactum.com/stack-version" = var.pf_stack_version
    "panfactum.com/stack-commit"  = var.pf_stack_commit
    terraform                     = "true"
  })
}