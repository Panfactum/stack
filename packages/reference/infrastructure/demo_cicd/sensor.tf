
#############################################################
# Sensor
#############################################################

module "sensor" {
  source                    = "${var.pf_module_source}kube_argo_sensor${var.pf_module_ref}"

  name = "cicd"
  namespace = local.namespace

  dependencies = [
    {
      name = "push-to-main"
      eventSourceName = local.event_source_name
      eventName = "default"
      filters = {
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
      }
    },
    {
      template = {
        name = module.build_and_deploy_website_workflow.name
        conditions = "push-to-main"
        argoWorkflow = {
          operation = "submit"
          source = {
            resource = {
              apiVersion = "argoproj.io/v1alpha1"
              kind = "Workflow"
              metadata = {
                generateName = module.build_and_deploy_website_workflow.generate_name
                namespace = local.namespace
              }
              spec = {
                workflowTemplateRef = {
                  name = module.build_and_deploy_website_workflow.name
                }
              }
            }
          }
        }
      }
    },
    {
      template = {
        name = module.resource_update_workflow.name
        conditions = "push-to-main"
        argoWorkflow = {
          operation = "submit"
          source = {
            resource = {
              apiVersion = "argoproj.io/v1alpha1"
              kind = "Workflow"
              metadata = {
                generateName = module.resource_update_workflow.generate_name
                namespace = local.namespace
              }
              spec = {
                arguments = module.resource_update_workflow.arguments
                workflowTemplateRef = {
                  name = module.resource_update_workflow.name
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
      }
    },
    {
      template = {
        name = "log"
        log = {
          intervalSeconds = 1
        }
      }
    }
  ]
}
