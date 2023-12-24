terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.22"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "5.10"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "3.19.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.5.1"
    }
    time = {
      source  = "hashicorp/time"
      version = "0.9.1"
    }
  }
}

locals {

  service = "public-app"

  // Extract values from the enforced kubernetes labels
  environment = var.environment
  module      = var.module
  version     = var.version_tag

  labels = merge(var.kube_labels, {
    service = local.service
  })

  namespace = module.namespace.namespace

  is_local = var.is_local

  port              = 3000
  healthcheck_route = "/"

  minimum_memory = local.is_local ? 1024 * 12 : 1024
}

module "constants" {
  source = "../../modules/constants"
}

/***************************************
* Namespace
***************************************/

module "namespace" {
  source            = "../../modules/kube_namespace"
  namespace         = var.namespace
  admin_groups      = ["system:admins"]
  reader_groups     = ["system:readers"]
  bot_reader_groups = ["system:bot-readers"]
  kube_labels       = local.labels
}

/***************************************
* Deployment
***************************************/

resource "kubernetes_service_account" "service" {
  metadata {
    name      = local.service
    namespace = local.namespace
    labels    = local.labels
  }
}

module "deployment" {
  source   = "../../modules/kube_deployment"
  is_local = local.is_local

  kube_labels     = local.labels
  namespace       = local.namespace
  service_name    = local.service
  service_account = kubernetes_service_account.service.metadata[0].name

  deployment_update_type = local.is_local ? "Recreate" : "RollingUpdate" // Speeds things up when we need to tilt redeploy

  common_env = {
    NODE_ENV                      = local.is_local ? "development" : "production"
    NEXT_PUBLIC_API_URL           = var.primary_api_url
    NEXT_PUBLIC_MUI_X_LICENSE_KEY = var.mui_x_license_key
  }

  containers = [{
    name    = "server"
    image   = var.image_repo
    version = var.image_version
    command = local.is_local ? [
      "node_modules/.bin/next",
      "dev",
      "-p", local.port
      ] : [
      "./entrypoint.sh",
      "node_modules/.bin/next",
      "start",
      "-p", local.port
    ]
    readonly       = local.is_local // in our nonlocal deployment, we do env subst so it cannot be readonly
    minimum_memory = local.minimum_memory
    env = {
      NODE_OPTIONS = "--max-old-space-size=${local.minimum_memory * 0.75}"
    }
    // Disable healthchecks when running in localdev b/c the healthchecks break
    // when the server is compiling the code which then triggers unwanted restarts
    healthcheck_type  = local.is_local ? null : "HTTP"
    healthcheck_port  = local.is_local ? null : local.port
    healthcheck_route = local.is_local ? null : local.healthcheck_route
  }]

  tmp_directories = local.is_local ? {
    "/code/packages/public-app/.next" : {
      size_gb = 5
    }
  } : {}

  min_replicas = var.min_replicas
  max_replicas = var.max_replicas
  vpa_enabled  = var.vpa_enabled

  ports = {
    http = {
      pod_port     = local.port
      service_port = local.port
    }
  }
}

module "ingress" {
  source = "../../modules/kube_ingress"

  namespace    = local.namespace
  kube_labels  = local.labels
  ingress_name = local.service

  ingress_configs = [{
    domains      = var.ingress_domains
    service      = module.deployment.service
    service_port = local.port
  }]

  // Disable ratelimiting in local development due to the number
  // of files needing to be served by the dev server
  enable_ratelimiting = !local.is_local
}
