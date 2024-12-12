##############################################################
## This is an example of simply building a Dockerfile
###############################################################
module "website_builder" {
  source                    = "${var.pf_module_source}wf_dockerfile_build${var.pf_module_ref}"

  name = "website-builder"
  namespace = local.namespace
  pull_through_cache_enabled = var.pull_through_cache_enabled

  code_repo = "github.com/panfactum/stack.git"
  dockerfile_path = "./packages/website/Containerfile"
  image_repo = "website"

  args = {
    ALGOLIA_APP_ID = var.algolia_app_id
    ALGOLIA_SEARCH_API_KEY = var.algolia_search_api_key
    ALGOLIA_INDEX_NAME = var.algolia_index_name
  }
}

##############################################################
## This creates a workflow-of-workflows that builds
## executes the dockerfile_build workflow and then the
## tf_deploy workflow afterwords; this has the effect
## of a rolling-update.
###############################################################

module "build_and_deploy_website_workflow" {
  source                    = "${var.pf_module_source}wf_spec${var.pf_module_ref}"

  name = "build-and-deploy-website"
  namespace = local.namespace
  active_deadline_seconds = 60 * 60
  workflow_parallelism = 10

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
