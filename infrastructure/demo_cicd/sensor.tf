
#############################################################
# Sensor
#############################################################

module "sensor" {
  source = "${var.pf_module_source}kube_argo_sensor${var.pf_module_ref}"

  name      = "cicd"
  namespace = local.namespace

  dependencies = [
    {
      name            = "push"
      eventSourceName = local.event_source_name
      eventName       = "default"
      filters = {
        data = [
          {
            path  = "body.X-GitHub-Event"
            type  = "string"
            value = ["push"]
          },
          {
            path  = "body.repository.name"
            type  = "string"
            value = ["stack"]
          }
        ]
      }
    },
    {
      name            = "tag"
      eventSourceName = local.event_source_name
      eventName       = "default"
      filters = {
        data = [
          {
            path  = "body.X-GitHub-Event"
            type  = "string"
            value = ["create"]
          },
          {
            path  = "body.repository.name"
            type  = "string"
            value = ["stack"]
          },
          {
            path  = "body.ref_type"
            type  = "string"
            value = ["tag"]
          }
        ]
      }
    },
    {
      name            = "push-to-main"
      eventSourceName = local.event_source_name
      eventName       = "default"
      filters = {
        data = [
          {
            path  = "body.X-GitHub-Event"
            type  = "string"
            value = ["push"]
          },
          {
            path  = "body.ref"
            type  = "string"
            value = ["refs/heads/main"]
          },
          {
            path  = "body.repository.name"
            type  = "string"
            value = ["stack"]
          }
        ]
      }
    },
    {
      name            = "push-to-main-reference"
      eventSourceName = local.event_source_name
      eventName       = "default"
      filters = {
        data = [
          {
            path  = "body.X-GitHub-Event"
            type  = "string"
            value = ["push"]
          },
          {
            path  = "body.ref"
            type  = "string"
            value = ["refs/heads/main"]
          },
          {
            path  = "body.repository.name"
            type  = "string"
            value = ["stack"]
          }
        ]
      }
    },
    {
      name            = "push-to-test"
      eventSourceName = local.event_source_name
      eventName       = "default"
      filters = {
        dataLogicalOperator = "and"
        data = [
          {
            path  = "body.X-GitHub-Event"
            type  = "string"
            value = ["push"]
          },
          {
            path  = "body.ref"
            type  = "string"
            value = ["refs/heads/test"]
          },
          {
            path  = "body.repository.name"
            type  = "string"
            value = ["stack"]
          }
        ]
        script = <<-EOT
        ${file("${path.module}/is_modified.lua")}
        return is_modified(event.body, {
          "infrastructure/demo_cicd/.*",
          "environments/.*"
        })
        EOT
      }
    }
  ]

  triggers = [
    {
      template = {
        name       = local.nix_image_builder_name
        conditions = "push-to-main"
        argoWorkflow = {
          operation = "submit"
          source = {
            resource = {
              apiVersion = "argoproj.io/v1alpha1"
              kind       = "Workflow"
              metadata = {
                generateName = "${local.nix_image_builder_name}-"
                namespace    = local.namespace
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
                dataKey        = "body.after" # The git commit after the push
              }
            }
          ]
        }
      }
    },
    {
      template = {
        name       = local.bastion_image_builder_name
        conditions = "push-to-main"
        argoWorkflow = {
          operation = "submit"
          source = {
            resource = {
              apiVersion = "argoproj.io/v1alpha1"
              kind       = "Workflow"
              metadata = {
                generateName = "${local.bastion_image_builder_name}-"
                namespace    = local.namespace
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
                dataKey        = "body.after" # The git commit after the push
              }
            }
          ]
        }
      }
    },
    {
      template = {
        name       = local.website_astro_builder_name
        conditions = "push-to-main"
        argoWorkflow = {
          operation = "submit"
          source = {
            resource = {
              apiVersion = "argoproj.io/v1alpha1"
              kind       = "Workflow"
              metadata = {
                generateName = "${local.website_astro_builder_name}-"
                namespace    = local.namespace
              }
              spec = {
                arguments = {
                  parameters = [
                    {
                      name  = "git_ref"
                      value = "main"
                    },
                    {
                      name  = "sitemap_url"
                      value = "${var.site_url}/sitemap-index.xml"
                    },
                    {
                      name  = "algolia_index_name"
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
                dataKey        = "body.after" # The git commit after the push
              }
            }
          ]
        }
      }
    },
    {
      template = {
        name       = local.vault_image_builder_name
        conditions = "push-to-main"
        argoWorkflow = {
          operation = "submit"
          source = {
            resource = {
              apiVersion = "argoproj.io/v1alpha1"
              kind       = "Workflow"
              metadata = {
                generateName = "${local.vault_image_builder_name}-"
                namespace    = local.namespace
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
                dataKey        = "body.after" # The git commit after the push
              }
            }
          ]
        }
      }
    },
    {
      template = {
        name       = module.resource_update_workflow.name
        conditions = "push-to-main-reference"
        argoWorkflow = {
          operation = "submit"
          source = {
            resource = {
              apiVersion = "argoproj.io/v1alpha1"
              kind       = "Workflow"
              metadata = {
                generateName = module.resource_update_workflow.generate_name
                namespace    = local.namespace
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
                dataKey        = "body.after" # The git commit after the push
              }
            }
          ]
        }
      }
    },
    {
      template = {
        name       = module.module_uploader_workflow.name
        conditions = "push"
        argoWorkflow = {
          operation = "submit"
          source = {
            resource = {
              apiVersion = "argoproj.io/v1alpha1"
              kind       = "Workflow"
              metadata = {
                generateName = module.module_uploader_workflow.generate_name
                namespace    = local.namespace
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
                dependencyName = "push"
                dataKey        = "body.after" # The git commit after the push
              }
            }
          ]
        }
      }
    },

    {
      template = {
        name       = module.installer_uploader_workflow.name
        conditions = "tag"
        argoWorkflow = {
          operation = "submit"
          source = {
            resource = {
              apiVersion = "argoproj.io/v1alpha1"
              kind       = "Workflow"
              metadata = {
                generateName = module.installer_uploader_workflow.generate_name
                namespace    = local.namespace
              }
              spec = {
                arguments = module.installer_uploader_workflow.arguments
                workflowTemplateRef = {
                  name = module.installer_uploader_workflow.name
                }
              }
            }
          }
          parameters = [
            {
              dest = "spec.arguments.parameters.0.value"
              src = {
                dependencyName = "tag"
                dataKey        = "body.ref"
              }
            },
            {
              dest = "spec.arguments.parameters.1.value"
              src = {
                dependencyName = "tag"
                value          = "1"
              }
            }
          ]
        }
      }
    },
    {
      template = {
        name       = "${module.installer_uploader_workflow.name}-push"
        conditions = "push"
        argoWorkflow = {
          operation = "submit"
          source = {
            resource = {
              apiVersion = "argoproj.io/v1alpha1"
              kind       = "Workflow"
              metadata = {
                generateName = module.installer_uploader_workflow.generate_name
                namespace    = local.namespace
              }
              spec = {
                arguments = module.installer_uploader_workflow.arguments
                workflowTemplateRef = {
                  name = module.installer_uploader_workflow.name
                }
              }
            }
          }
          parameters = [
            {
              dest = "spec.arguments.parameters.0.value"
              src = {
                dependencyName = "push"
                dataKey        = "body.after"
              }
            },
            {
              dest = "spec.arguments.parameters.1.value"
              src = {
                dependencyName = "push"
                value          = "0"
              }
            }
          ]
        }
      }
    },
    {
      template = {
        name       = "${module.installer_uploader_workflow.name}-push-main"
        conditions = "push-to-main"
        argoWorkflow = {
          operation = "submit"
          source = {
            resource = {
              apiVersion = "argoproj.io/v1alpha1"
              kind       = "Workflow"
              metadata = {
                generateName = module.installer_uploader_workflow.generate_name
                namespace    = local.namespace
              }
              spec = {
                arguments = module.installer_uploader_workflow.arguments
                workflowTemplateRef = {
                  name = module.installer_uploader_workflow.name
                }
              }
            }
          }
          parameters = [
            {
              dest = "spec.arguments.parameters.0.value"
              src = {
                dependencyName = "push"
                value          = "main"
              }
            },
            {
              dest = "spec.arguments.parameters.1.value"
              src = {
                dependencyName = "push"
                value          = "0"
              }
            }
          ]
        }
      }
    },
    {
      template = {
        name       = module.build_and_deploy_demo_user_service_workflow.name
        conditions = "push-to-main-reference"
        argoWorkflow = {
          operation = "submit"
          source = {
            resource = {
              apiVersion = "argoproj.io/v1alpha1"
              kind       = "Workflow"
              metadata = {
                generateName = module.build_and_deploy_demo_user_service_workflow.generate_name
                namespace    = local.namespace
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
        name       = module.build_and_deploy_demo_tracker_service_workflow.name
        conditions = "push-to-main-reference"
        argoWorkflow = {
          operation = "submit"
          source = {
            resource = {
              apiVersion = "argoproj.io/v1alpha1"
              kind       = "Workflow"
              metadata = {
                generateName = module.build_and_deploy_demo_tracker_service_workflow.generate_name
                namespace    = local.namespace
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
        name       = module.build_and_deploy_demo_python_service_workflow.name
        conditions = "push-to-main-reference"
        argoWorkflow = {
          operation = "submit"
          source = {
            resource = {
              apiVersion = "argoproj.io/v1alpha1"
              kind       = "Workflow"
              metadata = {
                generateName = module.build_and_deploy_demo_python_service_workflow.generate_name
                namespace    = local.namespace
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
        name       = module.build_and_deploy_demo_java_service_workflow.name
        conditions = "push-to-main-reference"
        argoWorkflow = {
          operation = "submit"
          source = {
            resource = {
              apiVersion = "argoproj.io/v1alpha1"
              kind       = "Workflow"
              metadata = {
                generateName = module.build_and_deploy_demo_java_service_workflow.generate_name
                namespace    = local.namespace
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
