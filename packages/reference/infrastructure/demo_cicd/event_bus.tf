module "event_bus" {
  source =   "github.com/Panfactum/stack.git//packages/infrastructure/kube_argo_event_bus?ref=b9514b523707e25eae062b7a0f0c17450e1122d1" # pf-update

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
