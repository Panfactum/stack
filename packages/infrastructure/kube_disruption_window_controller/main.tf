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
  spot_nodes_enabled          = true
  arm_nodes_enabled           = true
  burstable_nodes_enabled     = true
  vpa_enabled                 = var.vpa_enabled

  cron_schedule = var.cron_schedule
  containers = [{
    name    = "enabler"
    image   = "${module.pull_through.ecr_public_registry}/${module.constants.panfactum_image}"
    version = module.constants.panfactum_image_version
    command = [
      "/bin/pf-voluntary-disruptions-enable",
      "--window-id=${random_id.window_id.hex}",
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

module "disruption_window_disabler" {
  source = "../kube_cron_job"

  name                        = "disruption-window-disabler-${random_id.window_id.hex}"
  namespace                   = var.namespace
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled
  spot_nodes_enabled          = true
  arm_nodes_enabled           = true
  burstable_nodes_enabled     = true
  vpa_enabled                 = var.vpa_enabled

  cron_schedule = "0/15 * * * *" # Every 15 minutes
  containers = [{
    name    = "disabler"
    image   = "${module.pull_through.ecr_public_registry}/${module.constants.panfactum_image}"
    version = module.constants.panfactum_image_version
    command = [
      "/bin/pf-voluntary-disruptions-disable",
      "--window-id=${random_id.window_id.hex}",
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
