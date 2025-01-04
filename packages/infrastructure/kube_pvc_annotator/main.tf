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
  module = "kube_pvc_annotator"
}

resource "kubectl_manifest" "update_image_cache" {
  yaml_body = yamlencode({
    apiVersion = "kyverno.io/v1"
    kind       = "Policy"
    metadata = {
      name      = "update-pvc-metadata-${lower(substr(base64encode(sha1(join("", keys(var.config)))), 0, 6))}"
      namespace = var.namespace
      labels    = data.pf_kube_labels.labels.labels
    }
    spec = {
      useServerSideApply = true
      rules = [for group, config in var.config : {
        name = "update-pvc-metadata-${lower(substr(base64encode(sha1(group)), 0, 6))}"
        match = {
          any = [{
            resources = {
              kinds = ["PersistentVolumeClaim"]
              selector = {
                matchLabels = {
                  "panfactum.com/pvc-group" = group
                }
              }
            }
          }]
        }
        mutate = {
          mutateExistingOnPolicyUpdate = true
          targets = [{
            apiVersion = "v1"
            kind       = "PersistentVolumeClaim"
            name       = "{{ request.object.metadata.name }}"
            namespace  = var.namespace
          }]
          patchStrategicMerge = {
            metadata = {
              labels      = config.labels
              annotations = config.annotations
            }
          }
        }
      }]
      webhookConfiguration = {
        failurePolicy = "Ignore"
      }
    }
  })

  force_new         = true
  force_conflicts   = true
  server_side_apply = true
}
