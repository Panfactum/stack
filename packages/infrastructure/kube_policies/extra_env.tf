
locals {
  common_env_context = [
    {
      name = "termSeconds"
      variable = {
        value    = "{{ request.object.spec.terminationGracePeriodSeconds }}"
        jmesPath = "to_string(@)" // This is necessary b/c otherwise this is interpreted as a number and causes pods to fail to launch
      }
    }
  ]
  common_env = [
    {
      name  = "CONTAINER_IMAGE"
      value = "{{ element.image }}"
    },
    {
      name  = "CONTAINER_IMAGE_TAG"
      value = "{{ '{{element.image}}' | split(@, ':') | [-1:] | [0] }}"
    },
    {
      name  = "CONTAINER_IMAGE_REPO"
      value = "{{ '{{element.image}}' | split(@, '/') | [1:] | join('/', @)}}"
    },
    {
      name  = "CONTAINER_IMAGE_REGISTRY"
      value = "{{ '{{element.image}}' | split(@, '/') | [0] }}"
    },
    {
      name  = "POD_TERMINATION_GRACE_PERIOD_SECONDS"
      value = "{{ termSeconds }}"
    },
    {
      name = "POD_IP"
      valueFrom = {
        fieldRef = {
          apiVersion = "v1"
          fieldPath  = "status.podIP"
        }
      }
    },
    {
      name = "POD_NAME"
      valueFrom = {
        fieldRef = {
          apiVersion = "v1"
          fieldPath  = "metadata.name"
        }
      }
    },
    {
      name  = "POD_NAMESPACE"
      value = "{{ request.object.metadata.namespace }}"
    },
    {
      name  = "NAMESPACE"
      value = "{{ request.object.metadata.namespace }}"
    },
    {
      name = "POD_SERVICE_ACCOUNT"
      valueFrom = {
        fieldRef = {
          apiVersion = "v1"
          fieldPath  = "spec.serviceAccountName"
        }
      }
    },
    {
      name = "NODE_NAME"
      valueFrom = {
        fieldRef = {
          apiVersion = "v1"
          fieldPath  = "spec.nodeName"
        }
      }
    },
    {
      name = "NODE_IP"
      valueFrom = {
        fieldRef = {
          apiVersion = "v1"
          fieldPath  = "status.hostIP"
        }
      }
    },
    {
      name = "CONTAINER_CPU_REQUEST"
      valueFrom = {
        resourceFieldRef = {
          resource = "requests.cpu"
        }
      }
    },
    {
      name = "CONTAINER_MEMORY_REQUEST"
      valueFrom = {
        resourceFieldRef = {
          resource = "requests.memory"
        }
      }
    },
    {
      name = "CONTAINER_MEMORY_LIMIT"
      valueFrom = {
        resourceFieldRef = {
          resource = "limits.memory"
        }
      }
    },
    {
      name = "GOMEMLIMIT"
      valueFrom = {
        resourceFieldRef = {
          resource = "requests.memory"
        }
      }
    },
    {
      name = "CONTAINER_EPHEMERAL_STORAGE_REQUEST"
      valueFrom = {
        resourceFieldRef = {
          resource = "requests.ephemeral-storage"
        }
      }
    },
    {
      name = "CONTAINER_EPHEMERAL_STORAGE_LIMIT"
      valueFrom = {
        resourceFieldRef = {
          resource = "limits.ephemeral-storage"
        }
      }
    }
  ]

  rule_add_environment_variables = var.environment_variable_injection_enabled ? [
    {
      name  = "ensure-env-array"
      match = local.match_any_pod_create
      mutate = {
        foreach = [
          {
            list = "request.object.spec.containers"
            patchStrategicMerge = {
              spec = {
                containers = [{
                  "(name)" = "{{ element.name }}"
                  env      = []
                }]
              }
            }
          }
        ]
      }
    },
    {
      name  = "ensure-env-array-init-containers"
      match = local.match_any_pod_create
      preconditions = {
        all = [{
          key      = "{{ request.object.spec.initContainers[] || `[]` | length(@) }}"
          operator = "GreaterThanOrEquals"
          value    = 1
        }]
      }
      mutate = {
        foreach = [
          {
            list = "request.object.spec.initContainers"
            patchStrategicMerge = {
              spec = {
                initContainers = [{
                  "(name)" = "{{ element.name }}"
                  env      = []
                }]
              }
            }
          }
        ]
      }
    },
    {
      name    = "add-environment-variables"
      match   = local.match_any_pod_create
      context = local.common_env_context
      exclude = {
        any = [
          {
            resources = {
              selector = {
                matchLabels = {
                  "panfactum.com/inject-env-enabled" = "false"
                }
              }
            }
          }
        ]
      }
      mutate = {
        foreach = [for env in local.common_env :
          {
            list = "request.object.spec.containers"
            preconditions = {
              any = [{
                key      = "{{ length(element.env[?(@.name=='${env.name}')]) }}"
                operator = "Equals"
                value    = 0
              }]
            }
            patchesJson6902 = yamlencode([
              {
                op    = "add"
                path  = "/spec/containers/{{elementIndex}}/env/0"
                value = env
              }
            ])
          }
        ]
      }
    },
    {
      name    = "add-environment-variables-init-containers"
      match   = local.match_any_pod_create
      context = local.common_env_context
      exclude = {
        any = [
          {
            resources = {
              selector = {
                matchLabels = {
                  "panfactum.com/inject-env-enabled" = "false"
                }
              }
            }
          }
        ]
      }
      preconditions = {
        all = [{
          key      = "{{ request.object.spec.initContainers[] || `[]` | length(@) }}"
          operator = "GreaterThanOrEquals"
          value    = 1
        }]
      }
      mutate = {
        foreach = [for env in local.common_env :
          {
            list = "request.object.spec.initContainers"
            preconditions = {
              any = [{
                key      = "{{ length(element.env[?(@.name=='${env.name}')]) }}"
                operator = "Equals"
                value    = 0
              }]
            }
            patchesJson6902 = yamlencode([
              {
                op    = "add"
                path  = "/spec/initContainers/{{elementIndex}}/env/0"
                value = env
              }
            ])
          }
        ]
      }
    },
  ] : [null, null, null, null]
}