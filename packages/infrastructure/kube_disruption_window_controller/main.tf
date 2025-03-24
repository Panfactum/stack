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
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
  }
}

module "constants" {
  source = "../kube_constants"
}

resource "random_id" "window_id" {
  byte_length = 8
}

resource "kubernetes_role" "controller" {
  metadata {
    name      = "controller-${random_id.window_id.hex}"
    namespace = var.namespace
    labels    = module.disruption_window_enabler.labels
  }
  rule {
    api_groups = ["policy"]
    resources  = ["poddisruptionbudgets"]
    verbs      = ["get", "update", "list", "patch"]
  }
}

resource "kubernetes_role_binding" "enabler" {
  metadata {
    name      = "enabler-${random_id.window_id.hex}"
    namespace = var.namespace
    labels    = module.disruption_window_enabler.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = module.disruption_window_enabler.service_account_name
    namespace = var.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.controller.metadata[0].name
  }
}

resource "kubernetes_role_binding" "disabler" {
  metadata {
    name      = "disabler-${random_id.window_id.hex}"
    namespace = var.namespace
    labels    = module.disruption_window_disabler.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = module.disruption_window_disabler.service_account_name
    namespace = var.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.controller.metadata[0].name
  }
}

module "disruption_window_enabler" {
  source = "../kube_cron_job"

  name                        = "disruption-window-enabler-${random_id.window_id.hex}"
  namespace                   = var.namespace
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled
  spot_nodes_enabled          = var.spot_nodes_enabled
  burstable_nodes_enabled     = var.burstable_nodes_enabled
  controller_nodes_enabled    = var.controller_nodes_enabled
  pull_through_cache_enabled  = var.pull_through_cache_enabled
  vpa_enabled                 = var.vpa_enabled

  cron_schedule = var.cron_schedule
  containers = [{
    name             = "enabler"
    image_registry   = "public.ecr.aws"
    image_repository = module.constants.panfactum_image_repository
    image_tag        = module.constants.panfactum_image_tag
    command = [
      "/bin/pf-voluntary-disruptions-enable",
      "--window-id=${random_id.window_id.hex}",
      "--namespace=${var.namespace}"
    ]
    minimum_memory = 50
  }]
  starting_deadline_seconds = 60 * 5
  active_deadline_seconds   = 60 * 5
}

module "disruption_window_disabler" {
  source = "../kube_cron_job"

  name                        = "disruption-window-disabler-${random_id.window_id.hex}"
  namespace                   = var.namespace
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled
  pull_through_cache_enabled  = var.pull_through_cache_enabled
  spot_nodes_enabled          = var.spot_nodes_enabled
  burstable_nodes_enabled     = var.burstable_nodes_enabled
  controller_nodes_enabled    = var.controller_nodes_enabled
  vpa_enabled                 = var.vpa_enabled

  cron_schedule = "0/15 * * * *" # Every 15 minutes
  containers = [{
    name             = "disabler"
    image_registry   = "public.ecr.aws"
    image_repository = module.constants.panfactum_image_repository
    image_tag        = module.constants.panfactum_image_tag
    command = [
      "/bin/pf-voluntary-disruptions-disable",
      "--window-id=${random_id.window_id.hex}",
      "--namespace=${var.namespace}"
    ]
    minimum_memory = 50
  }]
  starting_deadline_seconds = 60 * 5
  active_deadline_seconds   = 60 * 5
}
