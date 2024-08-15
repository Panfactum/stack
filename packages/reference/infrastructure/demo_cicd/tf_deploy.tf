
# This is an example of a workflow that deploys an entire region at once
module "tf_deploy" {
  source                    = "github.com/Panfactum/stack.git//packages/infrastructure/wf_tf_deploy?ref=9c215f8b2367b3f5758d4973741f38c0b88e89f5" #pf-update

  name = "tf-deploy-prod-us-east-2"
  namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  pull_through_cache_enabled = var.pull_through_cache_enabled

  repo = "github.com/panfactum/stack"
  tf_apply_dir = "packages/reference/environments/production"
  secrets = {
    AUTHENTIK_TOKEN = var.authentik_token
  }

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

