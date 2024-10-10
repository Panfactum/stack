terraform {
  required_providers {}
}

locals {
  name      = "external-dns"
  namespace = module.namespace.namespace
}

module "kube_external_dns_cloudflare" {
  count = length(var.cloudflare_zones) > 0 ? 1 : 0
  source = "./kube_external_dns_cloudflare"

  namespace = local.namespace
  vpa_enabled = var.vpa_enabled
  pull_through_cache_enabled = var.pull_through_cache_enabled
  log_level = var.log_level
  monitoring_enabled = var.monitoring_enabled
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled

  cloudflare_zones = var.cloudflare_zones
  cloudflare_api_token = var.cloudflare_api_token

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

module "kube_external_dns_aws" {
  count = length(var.route53_zones) > 0 ? 1 : 0
  source = "./kube_external_dns_aws"

  eks_cluster_name = var.eks_cluster_name
  namespace = local.namespace
  vpa_enabled = var.vpa_enabled
  pull_through_cache_enabled = var.pull_through_cache_enabled
  log_level = var.log_level
  monitoring_enabled = var.monitoring_enabled
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled

  route53_zones = var.route53_zones

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

/***************************************
* Kubernetes Resources
***************************************/

module "namespace" {
  source = "../kube_namespace"

  namespace = local.name

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