terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.3"
    }
  }
}

data "pf_kube_labels" "labels" {
  module = "kube_sync_secret"
}

resource "kubectl_manifest" "sync_secret" {
  yaml_body = yamlencode({
    apiVersion = "kyverno.io/v1"
    kind       = "ClusterPolicy"
    metadata = {
      name   = "sync-secret-${substr(sha1("${join(",", var.destination_namespaces)}${join(",", var.excluded_namespaces)}${var.secret_name}${var.secret_namespace}"), 0, 6)}"
      labels = data.pf_kube_labels.labels.labels
    }
    spec = {
      generateExisting = true
      rules = [
        { for k, v in {
          name = "sync-secret"
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
            apiVersion  = "v1"
            kind        = "Secret"
            name        = var.secret_name
            namespace   = "{{request.object.metadata.name}}"
            synchronize = true
            clone = {
              namespace = var.secret_namespace
              name      = var.secret_name
            }
          }
        } : k => v if v != null }
      ]
    }
  })

  force_conflicts   = true
  server_side_apply = true
}