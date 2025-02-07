
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
        name = local.website_astro_builder_name
        conditions = "push-to-main"
        argoWorkflow = {
          operation = "submit"
          source = {
            resource = {
              apiVersion = "argoproj.io/v1alpha1"
              kind = "Workflow"
              metadata = {
                generateName = "${local.website_astro_builder_name}-"
                namespace = local.namespace
              }
              spec = {
                arguments = {
                  parameters = [
                    {
                      name = "git_ref"
                      value = "main"
                    },
                    {
                      name = "sitemap_url"
                      value = "${var.site_url}/sitemap-index.xml"
                    },
                    {
                      name = "algolia_index_name"
                      value = "${var.algolia_index_name_2}"
                    }
                  ]
                }
                workflowTemplateRef = {
                  name = local.website_astro_builder_name
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
        name = local.vault_image_builder_name
        conditions = "push-to-main"
        argoWorkflow = {
          operation = "submit"
          source = {
            resource = {
              apiVersion = "argoproj.io/v1alpha1"
              kind = "Workflow"
              metadata = {
                generateName = "${local.vault_image_builder_name}-"
                namespace = local.namespace
              }
              spec = {
                arguments = module.vault_image_builder_workflow.arguments
                workflowTemplateRef = {
                  name = local.vault_image_builder_name
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
        name = module.module_uploader_workflow.name
        conditions = "push-to-main"
        argoWorkflow = {
          operation = "submit"
          source = {
            resource = {
              apiVersion = "argoproj.io/v1alpha1"
              kind = "Workflow"
              metadata = {
                generateName = module.module_uploader_workflow.generate_name
                namespace = local.namespace
              }
              spec = {
                arguments = module.module_uploader_workflow.arguments
                workflowTemplateRef = {
                  name = module.module_uploader_workflow.name
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
        name = module.build_and_deploy_demo_user_service_workflow.name
        conditions = "push-to-main"
        argoWorkflow = {
          operation = "submit"
          source = {
            resource = {
              apiVersion = "argoproj.io/v1alpha1"
              kind = "Workflow"
              metadata = {
                generateName = module.build_and_deploy_demo_user_service_workflow.generate_name
                namespace = local.namespace
              }
              spec = {
                workflowTemplateRef = {
                  name = module.build_and_deploy_demo_user_service_workflow.name
                }
              }
            }
          }
        }
      }
    },

    {
      template = {
        name = module.build_and_deploy_demo_tracker_service_workflow.name
        conditions = "push-to-main"
        argoWorkflow = {
          operation = "submit"
          source = {
            resource = {
              apiVersion = "argoproj.io/v1alpha1"
              kind = "Workflow"
              metadata = {
                generateName = module.build_and_deploy_demo_tracker_service_workflow.generate_name
                namespace = local.namespace
              }
              spec = {
                workflowTemplateRef = {
                  name = module.build_and_deploy_demo_tracker_service_workflow.name
                }
              }
            }
          }
        }
      }
    },

    {
      template = {
        name = module.build_and_deploy_demo_python_service_workflow.name
        conditions = "push-to-main"
        argoWorkflow = {
          operation = "submit"
          source = {
            resource = {
              apiVersion = "argoproj.io/v1alpha1"
              kind = "Workflow"
              metadata = {
                generateName = module.build_and_deploy_demo_python_service_workflow.generate_name
                namespace = local.namespace
              }
              spec = {
                workflowTemplateRef = {
                  name = module.build_and_deploy_demo_python_service_workflow.name
                }
              }
            }
          }
        }
      }
    },

    {
      template = {
        name = module.build_and_deploy_demo_java_service_workflow.name
        conditions = "push-to-main"
        argoWorkflow = {
          operation = "submit"
          source = {
            resource = {
              apiVersion = "argoproj.io/v1alpha1"
              kind = "Workflow"
              metadata = {
                generateName = module.build_and_deploy_demo_java_service_workflow.generate_name
                namespace = local.namespace
              }
              spec = {
                workflowTemplateRef = {
                  name = module.build_and_deploy_demo_java_service_workflow.name
                }
              }
            }
          }
        }
      }
    },


#     {
#       template = {
#         name = "log"
#         log = {
#           intervalSeconds = 1
#         }
#       }
#     }
  ]

  depends_on = [module.event_bus]
}
