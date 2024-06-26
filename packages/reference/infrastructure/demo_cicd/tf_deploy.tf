locals {

}

module "tf_deploy_prod_us_east_2" {
  source                    = "../../../../../infrastructure//wf_tf_deploy" #pf-update

  name = "tf-deploy-prod-us-east-2"
  namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  pull_through_cache_enabled = var.pull_through_cache_enabled

  repo_url = "github.com/panfactum/stack"
  repo_name = "stack"
  tf_apply_dir = "packages/reference/environments/production/us-east-2"
  secrets = {
    AUTHENTIK_TOKEN = var.authentik_token
  }

  # Only needed since the reference code isn't
  # at the root of the repository. Do not provide
  # this normally.
  alternative_devenv_root = "packages/reference"

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

