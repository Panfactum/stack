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
  }
}

data "pf_kube_labels" "labels" {
  module = "kube_node_image_cache"
}

resource "random_id" "policy_name" {
  prefix      = "image-cache-"
  byte_length = 8
}

resource "kubectl_manifest" "update_image_cache" {
  yaml_body = yamlencode({
    apiVersion = "kyverno.io/v1"
    kind       = "ClusterPolicy"
    metadata = {
      name   = random_id.policy_name.hex
      labels = data.pf_kube_labels.labels.labels
    }
    spec = {
      mutateExistingOnPolicyUpdate = true
      rules = flatten([for arch in ["amd64", "arm64"] : [
        {
          name = "update-images-${arch}"
          match = {
            any = [{
              resources = {
                kinds      = ["ConfigMap"]
                names      = ["images"]
                namespaces = ["node-image-cache"]
              }
            }]
          }
          mutate = {
            targets = [{
              apiVersion = "v1"
              kind       = "ConfigMap"
              name       = "images"
              namespace  = "node-image-cache"
            }]
            patchStrategicMerge = {
              data = { for i, image in var.images : "${random_id.policy_name.hex}-${i}" => image }
            }
          }
        }
      ]])
    }
  })

  force_conflicts   = true
  server_side_apply = true
}