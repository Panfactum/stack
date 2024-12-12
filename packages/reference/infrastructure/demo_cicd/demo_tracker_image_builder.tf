module "demo_tracker_service_builder" {
  source                    = "${var.pf_module_source}wf_dockerfile_build${var.pf_module_ref}"

  name = "demo-tracker-service-builder"
  namespace = local.namespace
  pull_through_cache_enabled = var.pull_through_cache_enabled

  code_repo = "github.com/panfactum/stack.git"
  dockerfile_path = "./packages/reference/services/demo-tracker-service/Containerfile"
  build_context = "./packages/reference/services/demo-tracker-service"
  image_repo = "demo-tracker-service"

  args = {}
}

module "build_and_deploy_demo_tracker_service_workflow" {
  source                    = "${var.pf_module_source}wf_spec${var.pf_module_ref}"

  name = "build-and-deploy-demo-tracker-service"
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
      value = "packages/reference/environments/production/us-east-2/demo_tracker_service"
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
              name = module.demo_tracker_service_builder.name
              template = module.demo_tracker_service_builder.entrypoint
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

resource "kubectl_manifest" "build_and_deploy_demo_tracker_service_workflow_template" {
  yaml_body = yamlencode({
    apiVersion = "argoproj.io/v1alpha1"
    kind = "WorkflowTemplate"
    metadata = {
      name = module.build_and_deploy_demo_tracker_service_workflow.name
      namespace = local.namespace
      labels = module.build_and_deploy_demo_tracker_service_workflow.labels
    }
    spec = module.build_and_deploy_demo_tracker_service_workflow.workflow_spec
  })

  server_side_apply = true
  force_conflicts   = true
}
