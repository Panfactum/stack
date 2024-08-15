module "event_bus" {
  source =   "github.com/Panfactum/stack.git//packages/infrastructure/kube_argo_event_bus?ref=9c215f8b2367b3f5758d4973741f38c0b88e89f5" # pf-update

  namespace = local.namespace

  # pf-generate: pass_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}
