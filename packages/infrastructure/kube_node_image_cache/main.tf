terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.34.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.1.3"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.5"
    }
  }
}

locals {
  image_string_list = [for image in var.images : "${image.registry}/${image.repository}:${image.tag}"]
  image_string_list_pinned = {
    amd64 = [for image in var.images : "${image.registry}/${image.repository}:${image.tag}" if image.pin_enabled && image.amd_nodes_enabled && image.repository != module.constants.images.devShell.repository] # We ignore the devShell image b/c it is already cached by default
    arm64 = [for image in var.images : "${image.registry}/${image.repository}:${image.tag}" if image.pin_enabled && image.arm_nodes_enabled && image.repository != module.constants.images.devShell.repository] # We ignore the devShell image b/c it is already cached by default
  }
  policy_name = "image-cache-${substr(sha1(join("", [for image in local.image_string_list : sha1(image)])), 0, 6)}"
}

module "constants" {
  source = "../kube_constants"
}

data "pf_kube_labels" "labels" {
  module = "kube_node_image_cache"
}

resource "kubectl_manifest" "update_image_cache" {
  yaml_body = yamlencode({
    apiVersion = "kyverno.io/v1"
    kind       = "ClusterPolicy"
    metadata = {
      name   = local.policy_name
      labels = data.pf_kube_labels.labels.labels
      annotations = {
        "pod-policies.kyverno.io/autogen-controllers" = "none"
      }
    }
    spec = {
      useServerSideApply = true
      rules = flatten([for arch in ["amd64", "arm64"] : [

        // Add the images to the `images` configmap will make sure
        // the images are included in the DS that pins images to each node
        {
          name                   = "update-pinned-images-${arch}"
          skipBackgroundRequests = false
          match = {
            any = [{
              resources = {
                kinds      = ["ConfigMap"]
                names      = ["pinned-images-${arch}"]
                namespaces = ["node-image-cache"]
              }
            }]
          }
          mutate = {
            mutateExistingOnPolicyUpdate = true
            targets = [{
              apiVersion = "v1"
              kind       = "ConfigMap"
              name       = "pinned-images-${arch}"
              namespace  = "node-image-cache"
            }]
            patchStrategicMerge = {
              data = { for i, image in local.image_string_list_pinned[arch] : lower(substr(base64encode(sha1(image)), 0, 10)) => image }
            }
          }
        }
      ]])

      webhookConfiguration = {
        failurePolicy = "Ignore"
      }
    }
  })

  force_new         = true
  force_conflicts   = true
  server_side_apply = true
}