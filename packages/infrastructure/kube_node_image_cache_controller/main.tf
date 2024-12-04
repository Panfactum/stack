terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.3"
    }
    http = {
      source  = "hashicorp/http"
      version = "3.4.5"
    }
  }
}

locals {
  name      = "node-image-cache"
  namespace = module.namespace.namespace
}

module "constants" {
  source = "../kube_constants"
}

module "namespace" {
  source = "../kube_namespace"

  namespace      = local.name
  linkerd_inject = false
}

data "pf_kube_labels" "labels" {
  module = "kube_node_image_cache_controller"
}

/***********************************************
* Caching DaemonSet
************************************************/

// We provide statically linked Go binaries that simply sleep in a loop for each supported
// CPU architecture. This enables us to run a container that does nothing even using container images
// where no other utilities are installed (e.g., distroless).
//
// The binaries are fairly large (~500KB) so it would not be a good idea to include them in the module
// bundle directly as they would increase its size significantly. As a result, we download them separately.
//
// The process for generating the binaries is as follows (replace flags for the relevant CPU arch):
// 1. GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o sleep_amd64 sleep.go (compile main.go in this folder)
// 2. upx --best sleep_amd64 (run a binary size optimizer)
// 3. cat sleep_amd64 | base64 > sleep_amd64_b64 (base64 encode the binary so it can be downloaded using the HTTP provider)
// 4. Upload sleep_amd64_b64 to the pf-modules-website S3 bucket so it can be downloaded from a public URL
data "http" "sleep_binary" {
  for_each = toset(["amd64", "arm64"])
  url      = "https://modules.panfactum.com/sleep_${each.key}_b64"

  retry {
    attempts     = 2
    min_delay_ms = 5000
  }
}

data "http" "noop_binary" {
  for_each = toset(["amd64", "arm64"])
  url      = "https://modules.panfactum.com/noop_${each.key}_b64"

  retry {
    attempts     = 2
    min_delay_ms = 5000
  }
}

resource "kubernetes_config_map" "scripts" {
  metadata {
    name      = "node-image-cache-scripts"
    namespace = local.namespace
    labels    = data.pf_kube_labels.labels.labels
  }

  # Wrap in sensitive so we don't pollute the logs with binary output
  binary_data = {
    "sleep_amd64" = sensitive(data.http.sleep_binary["amd64"].response_body)
    "sleep_arm64" = sensitive(data.http.sleep_binary["arm64"].response_body)
  }
}

resource "kubernetes_config_map" "noop_scripts" {
  metadata {
    name      = "node-image-cache-noop-scripts" // No not change this name without updating kube_node_image_cache
    namespace = local.namespace
    labels    = data.pf_kube_labels.labels.labels
  }

  # Wrap in sensitive so we don't pollute the logs with binary output
  binary_data = {
    "noop_amd64" = sensitive(data.http.noop_binary["amd64"].response_body)
    "noop_arm64" = sensitive(data.http.noop_binary["arm64"].response_body)
  }
}

resource "kubectl_manifest" "kyverno_policy" {
  yaml_body = yamlencode({
    apiVersion = "kyverno.io/v1"
    kind       = "ClusterPolicy"
    metadata = {
      name   = "node-image-cache-controller"
      labels = data.pf_kube_labels.labels.labels
      annotations = {
        "pod-policies.kyverno.io/autogen-controllers" = "none"
      }
    }
    spec = {
      rules = flatten([
        for arch in ["arm64", "amd64"] : [
          # This ConfigMap will contain all of the images that should be cached (minus the devShell which is cached by default in the DS)
          # It is populated by Kyverno policies in kube_node_image_cache, not here. This rule simply recreates the configmap if it is ever deleted.
          {
            name                   = "generate-pinned-images-${arch}-configmap"
            skipBackgroundRequests = false
            match = {
              any = [
                {
                  resources = {
                    kinds = ["Namespace"]
                    names = [local.namespace]
                  }
                }
              ]
            }
            generate = {
              generateExisting = true
              apiVersion       = "v1"
              kind             = "ConfigMap"
              name             = "pinned-images-${arch}"
              namespace        = local.namespace
              data = {
                kind = "ConfigMap"
                metadata = {
                  labels = merge(data.pf_kube_labels.labels.labels, {
                    "cleanup.kyverno.io/ttl" = "4h"
                    # Periodically delete the configmap. This is how we remove images that should no longer be in the cache.
                  })
                  annotations = {
                    "cache.kyverno.io/enabled" = "false"
                  }
                }
                data = {}
              }
            }
          },

          // We cannot use the Reloader here b/c it restarts the pods too quickly.
          // Instead we delay the regeneration for 2 min to allow the configmap updates
          // to settle before restarting the cache pods
          {
            name                   = "regenerate-pinning-pods-${arch}"
            skipBackgroundRequests = false
            match = {
              any = [
                {
                  resources = {
                    kinds      = ["ConfigMap"]
                    names      = ["pinned-images-${arch}"]
                    namespaces = [local.namespace]
                  }
                }
              ]
            }
            mutate = {
              mutateExistingOnPolicyUpdate = true
              targets = [
                {
                  apiVersion = "v1"
                  kind       = "Pod"
                  namespace  = local.namespace
                  preconditions = {
                    all = [
                      {
                        key      = "{{target.metadata.name}}"
                        operator = "Equals"
                        value    = "node-image-cache-pinner-${arch}-*"
                      }
                    ]
                  }
                }
              ]
              patchStrategicMerge = {
                metadata = {
                  labels = {
                    "cleanup.kyverno.io/ttl" = "{{ replace_all( '{{ time_add('{{ time_now() }}','2m') }}', ':', '') }}"
                  }
                }
              }
            }
          }
        ]
      ])
    }
  })

  force_new         = true
  force_conflicts   = true
  server_side_apply = true
}

// Since the prepull pods are not owned by any controller, they need to be cleaned up by us.
// We provide an eviction label that then allows the descheduler to remove them.
resource "kubectl_manifest" "gc_prepull_pods" {
  yaml_body = yamlencode({
    apiVersion = "kyverno.io/v1"
    kind       = "ClusterPolicy"
    metadata = {
      name   = "gc-prepull-pods"
      labels = data.pf_kube_labels.labels.labels
      annotations = {
        "pod-policies.kyverno.io/autogen-controllers" = "none"
      }
    }
    spec = {
      rules = [
        {
          name = "gc-prepull-pods"
          match = {
            any = [
              {
                resources = {
                  kinds      = ["Pod"]
                  namespaces = [local.namespace]
                  names      = ["node-image-cache-prepull-*"]
                }
              }
            ]
          }
          preconditions = {
            all = [
              {
                key      = "{{ request.object.status.phase || 'Pending' }}"
                operator = "AnyIn"
                value    = "Succeeded"
              }
            ]
          }
          mutate = {
            mutateExistingOnPolicyUpdate = true
            targets = [{
              apiVersion = "v1"
              kind       = "Pod"
              name       = "{{ request.object.metadata.name }}"
              namespace  = local.namespace
            }]
            patchStrategicMerge = {
              metadata = {
                labels = {
                  "+(cleanup.kyverno.io/ttl)" = "1m"
                }
              }
            }
          }
        }
      ]

      // If this fails for some reason, we do not want to prevent pods from being updated
      webhookConfiguration = {
        failurePolicy = "Ignore"
      }
    }
  })

  force_new         = true
  force_conflicts   = true
  server_side_apply = true
}

# We have a different DS for each CPU architecture as we inject a CPU-arch-specific sleep binary into each image
# so we can generate a running container that uses very minimal resources (thus keeping the image pinned to the node)
module "node_image_cache" {
  source   = "../kube_daemon_set"
  for_each = toset(["amd64", "arm64"])

  namespace                  = local.namespace
  name                       = "node-image-cache-pinner-${each.key}"
  pull_through_cache_enabled = var.pull_through_cache_enabled
  node_requirements = {
    "kubernetes.io/arch" = [each.key]
  }

  extra_annotations = {
    "reloader.stakater.com/auto" = "false"
  }

  extra_pod_labels = {
    # As the DS pods will end up with many containers, injecting env vars causes
    # the pod manifest to exceed the size limits
    "panfactum.com/inject-env-enabled" = "false"

    # Restart this pod fairly regularly in case it somehow becomes out of sync
    # with the configmap of pinned images
    "cleanup.kyverno.io/ttl" = "4h"
  }

  containers = [
    {
      name             = "dev-shell"
      image_registry   = module.constants.images.devShell.registry
      image_repository = module.constants.images.devShell.repository
      image_tag        = module.constants.images.devShell.tag
      command = [
        "/scripts/sleep_${each.key}"
      ]
      minimum_memory          = 1
      memory_limit_multiplier = 4
      minimum_cpu             = 1
      maximum_cpu             = 10
    }
  ]

  termination_grace_period_seconds = 1    # Quick shutdown
  host_network                     = true # Allows this to startup quicker as does not need to wait for CNI

  config_map_mounts = {
    "${kubernetes_config_map.scripts.metadata[0].name}" = {
      mount_path = "/scripts"
    }
  }

  extra_tolerations = [
    {
      effect   = "NoSchedule"
      key      = module.constants.cilium_taint.key
      operator = "Exists"
    },
    {
      effect   = "NoSchedule"
      key      = module.constants.linkerd_taint.key
      operator = "Exists"
    },
    {
      effect   = "NoSchedule"
      key      = "node.kubernetes.io/not-ready"
      operator = "Exists"
    },
    {
      effect   = "NoExecute"
      key      = "node.kubernetes.io/not-ready"
      operator = "Exists"
    }
  ]

  vpa_enabled                = false
  pod_version_labels_enabled = false

  depends_on = [kubectl_manifest.kyverno_policy]
}
