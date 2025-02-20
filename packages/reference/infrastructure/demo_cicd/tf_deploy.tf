
# This is an example of a workflow that deploys an entire region at once
module "tf_deploy" {
  source                    = "${var.pf_module_source}wf_tf_deploy${var.pf_module_ref}"

  name = "tf-deploy-prod"
  namespace = local.namespace

  repo = "github.com/panfactum/stack.git"
  tf_apply_dir = "packages/reference/environments/production"
  secrets = {
    AUTHENTIK_TOKEN = var.authentik_token
  }
}

