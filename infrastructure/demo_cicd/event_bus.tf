module "event_bus" {
  source = "${var.pf_module_source}kube_argo_event_bus${var.pf_module_ref}"

  namespace                            = local.namespace
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  instance_type_anti_affinity_required = false // You probably want to leave this as true, but we disable this for cost savings
}
