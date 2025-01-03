terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.34.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.1.3"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.7"
    }
  }
}

data "pf_kube_labels" "labels" {
  module = "kube_sync_config_map"
}

resource "kubectl_manifest" "sync_config_map" {
  yaml_body = yamlencode({
    apiVersion = "kyverno.io/v1"
    kind       = "ClusterPolicy"
    metadata = {
      name   = "sync-config-map-${substr(sha1("${join(",", var.destination_namespaces)}${join(",", var.excluded_namespaces)}${var.config_map_name}${var.config_map_namespace}"), 0, 6)}"
      labels = data.pf_kube_labels.labels.labels
    }
    spec = {
      rules = [
        { for k, v in {
          name = "sync-config-map"
          match = {
            any = [{
              resources = { for k, v in {
                kinds = ["Namespace"]
                names = length(var.destination_namespaces) > 0 ? var.destination_namespaces : null
              } : k => v if v != null }
            }]
          }
          exclude = length(var.excluded_namespaces) > 0 ? {
            any = [{
              resources = {
                names = var.excluded_namespaces
              }
            }]
          } : null
          generate = {
            apiVersion       = "v1"
            kind             = "ConfigMap"
            name             = var.config_map_name
            namespace        = "{{request.object.metadata.name}}"
            generateExisting = true
            synchronize      = true
            clone = {
              namespace = var.config_map_namespace
              name      = var.config_map_name
            }
          }
        } : k => v if v != null }
      ]
    }
  })

  force_conflicts   = true
  server_side_apply = true
}