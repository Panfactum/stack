#############################################################
# RBAC
#
# The Sensor is a Deployment and we need to give it permissions
# to create and access workflows
#############################################################

resource "kubernetes_service_account" "sensor" {
  metadata {
    name = "cicd-sensor"
    namespace = local.namespace
  }
}

resource "kubernetes_role" "sensor" {
  metadata {
    name = "cicd-sensor"
    namespace = local.namespace
  }
  rule {
    api_groups = ["argoproj.io"]
    resources  = ["workflows", "workflowtemplates"]
    verbs      = ["*"]
  }
}

resource "kubernetes_role_binding" "sensor" {
  metadata {
    name = "cicd-sensor"
    namespace = local.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.sensor.metadata[0].name
  }
  subject {
    kind = "ServiceAccount"
    name = kubernetes_service_account.sensor.metadata[0].name
    namespace = local.namespace
  }
}

#############################################################
# Sensor
#############################################################

resource "kubectl_manifest" "sensor" {
  yaml_body = yamlencode({
    apiVersion = "argoproj.io/v1alpha1"
    kind = "Sensor"
    metadata = {
      name = "cicd-sensor"
      namespace = local.namespace
    }
    spec = {
      template = {
        serviceAccountName = kubernetes_service_account.sensor.metadata[0].name
      }
      dependencies = [
        {
          name = "push-to-main"
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
                value = ["refs/heads/main"]
              }
            ]
          }
        }
      ]
      triggers = [
        {
          template = {
            name = local.nix_image_builder_name
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
            name = "log"
            log = {
              intervalSeconds = 1
            }
          }
        }
      ]
    }
  })
}