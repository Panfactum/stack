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

            apiVersion       = "v1"
            kind             = "Secret"
            name             = var.secret_name
            namespace        = "{{request.object.metadata.name}}"
            synchronize      = true
            generateExisting = true
            clone = {
              namespace = var.secret_namespace
              name      = var.secret_name
            }
          }
        } : k => v if v != null }
      ]
      webhookConfiguration = {
        failurePolicy = "Ignore"
      }
    }
  })

  force_conflicts   = true
  server_side_apply = true
}