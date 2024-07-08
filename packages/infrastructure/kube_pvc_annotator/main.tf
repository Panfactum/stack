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
  }
}

module "pull_through" {
  source                     = "../aws_ecr_pull_through_cache_addresses"
  pull_through_cache_enabled = var.pull_through_cache_enabled
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
    labels    = module.pvc_annotator.labels
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
    labels    = module.pvc_annotator.labels
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
  spot_nodes_enabled          = true
  arm_nodes_enabled           = true
  burstable_nodes_enabled     = true
  vpa_enabled                 = var.vpa_enabled

  cron_schedule = "*/15 * * * *"
  containers = [{
    name    = "pvc-annotate"
    image   = "${module.pull_through.ecr_public_registry}/${module.constants.panfactum_image}"
    version = module.constants.panfactum_image_version
    command = [
      "/bin/pf-set-pvc-metadata",
      "--config=${jsonencode(var.config)}",
      "--namespace=${var.namespace}"
    ]
    minimum_memory = 50
  }]
  starting_deadline_seconds = 60 * 5
  active_deadline_seconds   = 60 * 5

  # pf-generate: pass_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}
