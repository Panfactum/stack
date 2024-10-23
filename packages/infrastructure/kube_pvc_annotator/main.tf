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
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.3"
    }
  }
}

data "pf_kube_labels" "labels" {
  module = "kube_pvc_annotator"
}

module "constants" {
  source = "../kube_constants"
}

resource "random_id" "id" {
  byte_length = 8
  prefix      = "pvc-annotator-"
}

resource "kubernetes_role" "pvc_annotator" {
  metadata {
    name      = random_id.id.hex
    namespace = var.namespace
    labels    = merge(module.pvc_annotator.labels, data.pf_kube_labels.labels.labels)
  }
  rule {
    api_groups = [""]
    resources  = ["persistentvolumeclaims"]
    verbs      = ["get", "update", "list", "patch"]
  }
}

resource "kubernetes_role_binding" "pvc_annotator" {
  metadata {
    name      = random_id.id.hex
    namespace = var.namespace
    labels    = merge(module.pvc_annotator.labels, data.pf_kube_labels.labels.labels)
  }
  subject {
    kind      = "ServiceAccount"
    name      = module.pvc_annotator.service_account_name
    namespace = var.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.pvc_annotator.metadata[0].name
  }
}

module "pvc_annotator" {
  source = "../kube_cron_job"

  name                        = random_id.id.hex
  namespace                   = var.namespace
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled
  pull_through_cache_enabled  = var.pull_through_cache_enabled
  burstable_nodes_enabled     = true
  controller_nodes_enabled    = true
  vpa_enabled                 = var.vpa_enabled

  cron_schedule = "*/15 * * * *"
  containers = [{
    name             = "pvc-annotate"
    image_registry   = "public.ecr.aws"
    image_repository = module.constants.panfactum_image_repository
    image_tag        = module.constants.panfactum_image_tag
    command = [
      "/bin/pf-set-pvc-metadata",
      "--config=${jsonencode(var.config)}",
      "--namespace=${var.namespace}"
    ]
    minimum_memory = 50
  }]
  starting_deadline_seconds = 60 * 5
  active_deadline_seconds   = 60 * 5
}
