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
// 1. GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o sleep_amd64 main.go (compile main.go in this folder)
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

# This ConfigMap will contain all of the images that should be cached (minus the devShell which is cached by default in the DS)
# It is populated by Kyverno policies, not here.
resource "kubernetes_config_map" "images" {
  metadata {
    name      = "images"
    namespace = local.namespace
    labels    = data.pf_kube_labels.labels.labels
  }
  lifecycle {
    ignore_changes = [data]
  }
}

# We have a different DS for each CPU architecture as we inject a CPU-arch-specific sleep binary into each image
# so we can generate a running container that uses very minimal resources (thus keeping the image pinned to the node)
module "node_image_cache" {
  source   = "../kube_daemon_set"
  for_each = toset(["amd64", "arm64"])

  namespace                  = local.namespace
  name                       = "${local.name}-${each.key}"
  pull_through_cache_enabled = var.pull_through_cache_enabled
  node_requirements = {
    "kubernetes.io/arch" = [each.key]
  }

  containers = [
    {
      name             = "dev-shell"
      image_registry   = "public.ecr.aws"
      image_repository = module.constants.panfactum_image_repository
      image_tag        = module.constants.panfactum_image_tag
      command = [
        "/scripts/sleep_${each.key}"
      ]
      minimum_memory          = 2
      memory_limit_multiplier = 2.5
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
    "${kubernetes_config_map.images.metadata[0].name}" = {
      mount_path = "/etc/cached-images"
    }
  }

  extra_tolerations = [
    {
      effect   = "NoSchedule"
      key      = "node.cilium.io/agent-not-ready"
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
}
