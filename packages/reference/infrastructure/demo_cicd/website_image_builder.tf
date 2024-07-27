
module "website_builder" {
  source                    = "../../../../../infrastructure//wf_dockerfile_build" #pf-update

  name = "website-builder"
  namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  pull_through_cache_enabled = var.pull_through_cache_enabled

  code_repo = "https://github.com/panfactum/stack"
  dockerfile_path = "./packages/website/Containerfile"
  image_repo = "website"

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
