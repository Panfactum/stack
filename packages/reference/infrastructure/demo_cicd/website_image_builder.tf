##############################################################
## This is an example of simply building a Dockerfile
###############################################################
module "website_builder" {
  source                    = "github.com/Panfactum/stack.git//packages/infrastructure/wf_dockerfile_build?ref=704512d8ba8e8a6464546b0fedc93720c27de1d9" #pf-update

  name = "website-builder"
  namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  pull_through_cache_enabled = var.pull_through_cache_enabled

  code_repo = "github.com/panfactum/stack"
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

##############################################################
## This creates a workflow-of-workflows that builds
## executes the dockerfile_build workflow and then the
## tf_deploy workflow afterwords; this has the effect
## of a rolling-update.
###############################################################

module "build_and_deploy_website_workflow" {
  source                    = "github.com/Panfactum/stack.git//packages/infrastructure/wf_spec?ref=704512d8ba8e8a6464546b0fedc93720c27de1d9" #pf-update

  name = "build-and-deploy-website"
  namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  active_deadline_seconds = 60 * 60

  passthrough_parameters = [
    {
      name = "git_ref"
      value = "main"
    },
    {
      name = "tf_apply_dir"
      value = "packages/reference/environments/production/us-east-2/pf_website"
    }
  ]

  entrypoint = "entry"
  templates = [
    {
      name = "entry",
      dag = {
        tasks = [
          {
            name = "build-image"
            templateRef = {
              name = module.website_builder.name
              template = module.website_builder.entrypoint
            }
          },
          {
            name = "deploy-image"
            templateRef = {
              name = module.tf_deploy.name
              template = module.tf_deploy.entrypoint
            }
            depends = "build-image"
          }
        ]
      }
    }
  ]

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

resource "kubectl_manifest" "build_and_deploy_website_workflow_template" {
  yaml_body = yamlencode({
    apiVersion = "argoproj.io/v1alpha1"
    kind = "WorkflowTemplate"
    metadata = {
      name = module.build_and_deploy_website_workflow.name
      namespace = local.namespace
      labels = module.build_and_deploy_website_workflow.labels
    }
    spec = module.build_and_deploy_website_workflow.workflow_spec
  })

  server_side_apply = true
  force_conflicts   = true
}
