
# This is an example of a workflow that deploys an entire region at once
module "tf_deploy_prod_us_east_2" {
  source                    = "../../../../../infrastructure//wf_tf_deploy" #pf-update

  name = "tf-deploy-prod-us-east-2"
  namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  pull_through_cache_enabled = var.pull_through_cache_enabled

  repo = "github.com/panfactum/stack"
  tf_apply_dir = "packages/reference/environments/production/us-east-2"
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

# This is an example of a workflow that deploys a single module (aws_vpc)
module "tf_deploy_prod_us_east_2_aws_vpc" {
  source                    = "../../../../../infrastructure//wf_tf_deploy" #pf-update

  name = "deploy-prod-us-east-2-aws-vpc"
  namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  pull_through_cache_enabled = var.pull_through_cache_enabled

  repo = "github.com/panfactum/stack"
  tf_apply_dir = "packages/reference/environments/production/us-east-2/aws_vpc"

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


