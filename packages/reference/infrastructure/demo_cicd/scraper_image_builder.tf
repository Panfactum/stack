module "scraper_builder" {
  source                    = "github.com/Panfactum/stack.git//packages/infrastructure/wf_dockerfile_build?ref=e7bce6f03ec62851b2ca375337dd01253a84482d" #pf-update

  name = "scraper-builder"
  namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  pull_through_cache_enabled = var.pull_through_cache_enabled

  code_repo = "github.com/panfactum/stack"
  dockerfile_path = "./packages/scraper/Containerfile"
  image_repo = "scraper"

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
