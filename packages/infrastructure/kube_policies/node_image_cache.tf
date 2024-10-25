locals {
  // Note that this MUST be defined in this module in order for the pull-through cache replacement rules
  // to take effect
  rule_node_image_cache = var.panfactum_node_image_cache_enabled ? [for arch in ["amd64", "arm64"] :
    {
      name = "add-${arch}-image-to-image-cache"
      match = {
        any = [{
          resources = {
            kinds      = ["Pod"]
            names      = ["node-image-cache-${arch}-*"]
            namespaces = ["node-image-cache"]
            operations = ["CREATE"]
          }
        }]
      }
      context = [
        {
          name = "imagesToCache"
          configMap = {
            name      = "images"
            namespace = "node-image-cache"
          }
        }
      ]
      mutate = {
        foreach = [{
          list = "keys(imagesToCache.data)"
          patchStrategicMerge = {
            spec = {
              containers = [{
                name    = "{{ element }}"
                image   = "{{ imagesToCache.data.\"{{element}}\" }}"
                command = ["/scripts/sleep_${arch}"]
                resources = {
                  requests = {
                    cpu    = "1m"
                    memory = "2Mi"
                  }
                  limits = {
                    cpu    = "10m"
                    memory = "5Mi"
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
                volumeMounts = [{
                  mountPath = "/scripts"
                  name      = "config-map-node-image-cache-scripts"
                  readOnly  = true
                }]
              }]
            }
          }
        }]

      }
    }
  ] : [null, null]
}