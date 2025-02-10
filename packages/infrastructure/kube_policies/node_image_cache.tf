locals {
  // Note that this MUST be defined in this module in order for the pull-through cache replacement rules
  // to take effect
  rule_node_image_cache = var.panfactum_node_image_cache_enabled ? (flatten([
    for arch in ["amd64", "arm64"] : [
      {
        name = "add-${arch}-images-to-image-cache-pinner"
        match = {
          any = [
            {
              resources = {
                kinds      = ["Pod"]
                names      = ["node-image-cache-pinner-${arch}-*"]
                namespaces = ["node-image-cache"]
                operations = ["CREATE"]
              }
            }
          ]
        }
        context = [
          {
            name = "imagesToCache"
            configMap = {
              name      = "pinned-images-${arch}"
              namespace = "node-image-cache"
            }
          }
        ]
        preconditions = {
          all = [{
            key      = "{{ request.object.spec.containers[] || `[]` | length(@) }}"
            operator = "LessThanOrEquals"
            value    = 1
          }]
        }
        mutate = {
          foreach = [
            {
              list = "keys(imagesToCache.data)"
              patchStrategicMerge = {
                spec = {
                  containers = [
                    {
                      name    = "{{ element }}"
                      image   = "{{ imagesToCache.data.\"{{element}}\" }}"
                      command = ["/scripts/sleep_${arch}"]
                      resources = {
                        requests = {
                          cpu    = "1m"
                          memory = "1Mi"
                        }
                        limits = {
                          cpu    = "10m"
                          memory = "4Mi"
                        }
                      }
                      securityContext = {
                        allowPrivilegeEscalation = false
                        capabilities = {
                          drop = ["ALL"]
                        }
                        readOnlyRootFilesystem = true
                        runAsGroup             = 1000
                        runAsUser              = 1000
                      }
                      volumeMounts = [
                        {
                          mountPath = "/scripts"
                          name      = "config-map-node-image-cache-scripts"
                          readOnly  = true
                        }
                      ]
                    }
                  ]
                }
              }
            }
          ]

        }
      },


      // Anytime a node is created, this creates uni-image pods that pull the images immediately. Why?
      // Images are only pulled in parallel if they are from _separate_ pods (images in the same pod
      // are pulled serially). Since we want to make sure nodes have the images downloaded as quickly as possible
      // this is necessary; however, this won't pin the images to the nodes so that is why we also utilize
      // the daemonset.
      {
        name = "generate-prepull-pods-${arch}"
        match = {
          any = [
            {
              resources = {
                kinds      = ["Node"]
                operations = ["CREATE"]
                selector = {
                  matchLabels = {
                    "kubernetes.io/arch" = arch
                  }
                }
              }
            }
          ]
        }
        context = [
          {
            name = "imagesToCache"
            configMap = {
              name      = "pinned-images-${arch}"
              namespace = "node-image-cache"
            }
          }
        ]
        generate = {
          foreach = [
            {
              list       = "keys(imagesToCache.data)"
              apiVersion = "v1"
              kind       = "Pod"
              name       = "node-image-cache-prepull-${arch}-{{ random('[a-z0-9]{6}') }}"
              namespace  = "node-image-cache"
              data = merge(
                {
                  kind = "Pod"
                  metadata = {
                    labels      = module.prepull_pod[arch].pod_template.metadata.labels,
                    annotations = module.prepull_pod[arch].pod_template.metadata.annotations
                  }
                  spec = merge(
                    module.prepull_pod[arch].pod_template.spec,
                    {
                      affinity = {
                        nodeAffinity = {
                          requiredDuringSchedulingIgnoredDuringExecution = {
                            nodeSelectorTerms = [
                              {
                                matchExpressions = [
                                  {
                                    key      = "kubernetes.io/hostname"
                                    operator = "In"
                                    values   = ["{{request.object.metadata.name}}"]
                                  }
                                ]
                              }
                            ]
                          }
                        }
                      },
                      containers = [
                        merge(
                          module.prepull_pod[arch].pod_template.spec.containers[0],
                          {
                            name  = "{{ element }}"
                            image = "{{ imagesToCache.data.\"{{element}}\" }}"
                          }
                        )
                      ]
                    }
                  )
                }
              )
            }
          ]
        }
      }
    ]
  ])) : [null, null, null, null]
}


module "prepull_pod" {
  for_each = var.panfactum_node_image_cache_enabled ? toset(["amd64", "arm64"]) : toset([])
  source   = "../kube_pod"

  workload_name = "node-image-cache-puller"
  namespace     = "node-image-cache"

  // This should be allowed to run on any node
  extra_tolerations = [{ operator = "Exists" }]

  // Using the host network as this ensures this pod can be created before the Cilium CNI is installed
  host_network = true

  // This pod should never be restarted once completed
  restart_policy = "Never"

  // When bootstrapping, the namespace for this pod won't yet exist and having this set to
  // true will cause an issue
  default_permissions_enabled = false

  az_spread_required                   = false
  az_spread_preferred                  = false
  instance_type_anti_affinity_required = false
  az_anti_affinity_required            = false
  host_anti_affinity_required          = false
  termination_grace_period_seconds     = 0

  extra_pod_labels = {
    "panfactum.com/inject-env-enabled" = "false" # Unnecessary for this prepull pods
  }

  containers = [{
    name             = "dummy"
    image_registry   = "dummy"
    image_repository = "dummy"
    image_tag        = "dummy"
    command          = ["/scripts/noop_${each.key}"]
    minimum_memory   = 0
    maximum_memory   = 10
    minimum_cpu      = 0
  }]

  config_map_mounts = {
    node-image-cache-noop-scripts = {
      mount_path = "/scripts"
    }
  }
}