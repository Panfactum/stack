
#############################################################
# Sensor
#############################################################

module "sensor" {
  source                    = "../../../../../infrastructure//kube_argo_sensor" #pf-update

  name = "cicd"
  namespace = local.namespace
  vpa_enabled = true
  dependencies = [
    {
      name = "push-to-main"
      eventSourceName = local.event_source_name
      eventName = "default"
      filtersLogicalOperator = "and"
      filters = {
        dataLogicalOperator = "and"
        data = [
          {
            path = "body.X-GitHub-Event"
            type = "string"
            value = ["push"]
          },
          {
            path = "body.ref"
            type = "string"
            value = ["refs/heads/main"]
          }
        ]
      }
    },
    {
      name = "push-to-test"
      eventSourceName = local.event_source_name
      eventName = "default"
      filters = {
        dataLogicalOperator = "and"
        data = [
          {
            path = "body.X-GitHub-Event"
            type = "string"
            value = ["push"]
          },
          {
            path = "body.ref"
            type = "string"
            value = ["refs/heads/test"]
          }
        ]
        script = <<-EOT
        ${file("${path.module}/is_modified.lua")}
        return is_modified(event.body, {
          "packages/reference/infrastructure/demo_cicd/.*",
          "packages/reference/environments/.*"
        })
        EOT
      }
    }
  ]
  triggers = [
    {
      template = {
        name = local.nix_image_builder_name
        conditions = "push-to-main"
        argoWorkflow = {
          operation = "submit"
          source = {
            resource = {
              apiVersion = "argoproj.io/v1alpha1"
              kind = "Workflow"
              metadata = {
                generateName = "${local.nix_image_builder_name}-"
                namespace = local.namespace
              }
              spec = {
                arguments = module.nix_image_builder_workflow.arguments
                workflowTemplateRef = {
                  name = local.nix_image_builder_name
                }
              }
            }
          }
          parameters = [
            {
              dest = "spec.arguments.parameters.0.value"
              src = {
                dependencyName = "push-to-main"
                dataKey = "body.after" # The git commit after the push
              }
            }
          ]
        }
      },
      retryStrategy = {
        steps = 1
      }
    },
    {
      template = {
        name = local.bastion_image_builder_name
        conditions = "push-to-main"
        argoWorkflow = {
          operation = "submit"
          source = {
            resource = {
              apiVersion = "argoproj.io/v1alpha1"
              kind = "Workflow"
              metadata = {
                generateName = "${local.bastion_image_builder_name}-"
                namespace = local.namespace
              }
              spec = {
                arguments = module.bastion_image_builder_workflow.arguments
                workflowTemplateRef = {
                  name = local.bastion_image_builder_name
                }
              }
            }
          }
          parameters = [
            {
              dest = "spec.arguments.parameters.0.value"
              src = {
                dependencyName = "push-to-main"
                dataKey = "body.after" # The git commit after the push
              }
            }
          ]
        }
      },
      retryStrategy = {
        steps = 1
      }
    },
    {
      template = {
        name = local.website_image_builder_name
        conditions = "push-to-main"
        argoWorkflow = {
          operation = "submit"
          source = {
            resource = {
              apiVersion = "argoproj.io/v1alpha1"
              kind = "Workflow"
              metadata = {
                generateName = "${local.website_image_builder_name}-"
                namespace = local.namespace
              }
              spec = {
                arguments = module.website_image_builder_workflow.arguments
                workflowTemplateRef = {
                  name = local.website_image_builder_name
                }
              }
            }
          }
          parameters = [
            {
              dest = "spec.arguments.parameters.0.value"
              src = {
                dependencyName = "push-to-test"
                dataKey = "body.after" # The git commit after the push
              }
            }
          ]
        }
      },
      retryStrategy = {
        steps = 1
      }
    },
#    {
#      template = {
#        name = "log"
#        log = {
#          intervalSeconds = 1
#        }
#      }
#    }
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