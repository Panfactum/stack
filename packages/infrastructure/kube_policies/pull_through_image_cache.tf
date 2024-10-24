locals {
  pull_through_cache_registry = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com"
  registry_replacements = [
    { original = "^ghcr\\.io/(.*)$", new = "github/$1" },
    { original = "^cr\\.l5d\\.io/(.*)$", new = "github/$1" },
    { original = "^docker\\.io/(.*)$", new = "docker-hub/$1" },
    { original = "^quay\\.io/(.*)$", new = "quay/$1" },
    { original = "^registry\\.k8s\\.io/(.*)$", new = "kubernetes/$1" },
    { original = "^public\\.ecr\\.aws/(.*)$", new = "ecr-public/$1" },
    { original = "^([^.]*):(.*)$", new = "docker-hub/$1:$2" } // This is for the default docker registry
  ]
  exclude_pull_through_cache = {
    any = [
      {
        resources = {
          selector = {
            matchLabels = {
              "panfactum.com/pull-through-cache-enabled" = "false"
            }
          }
        }
      }
    ]
  }
}

resource "kubectl_manifest" "pull_through_image_cache" {
  yaml_body = yamlencode({
    apiVersion = "kyverno.io/v1"
    kind       = "ClusterPolicy"
    metadata = {
      name   = "use-pull-through-image-cache"
      labels = data.pf_kube_labels.labels.labels
    }
    spec = {
      rules = [
        {
          name    = "update-containers"
          match   = local.match_any_pod
          exclude = local.exclude_pull_through_cache
          mutate = {
            foreach = [for config in local.registry_replacements : {
              list = "request.object.spec.containers"
              patchStrategicMerge = {
                spec = {
                  containers = [{
                    name  = "{{ element.name }}"
                    image = "{{ regex_replace_all('${config.original}', '{{element.image}}', '${local.pull_through_cache_registry}/${config.new}' )}}"
                  }]
                }
              }
              }
            ]
          }
        },
        {
          name    = "update-init-containers"
          match   = local.match_any_pod
          exclude = local.exclude_pull_through_cache
          preconditions = {
            all = [{
              key      = "{{ request.object.spec.initContainers[] || `[]` | length(@) }}"
              operator = "GreaterThanOrEquals"
              value    = 1
            }]
          }
          mutate = {
            foreach = [for config in local.registry_replacements :
              {
                list = "request.object.spec.initContainers"
                patchStrategicMerge = {
                  spec = {
                    initContainers = [{
                      name  = "{{ element.name }}"
                      image = "{{ regex_replace_all('${config.original}', '{{element.image}}', '${local.pull_through_cache_registry}/${config.new}' )}}"
                    }]
                  }
                }
              }
            ]
          }
        }
      ]
    }
  })

  force_conflicts   = true
  server_side_apply = true
}