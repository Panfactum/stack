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

  service = "primary-api"

  // Extract values from the enforced kubernetes labels
  environment = var.environment
  module      = var.module
  version     = var.version_tag

  labels = merge(var.kube_labels, {
    service = local.service
  })

  namespace = module.namespace.namespace

  is_local = var.is_local

  port              = 8080
  healthcheck_route = "/v1/healthz"

  vault_role_name = "${local.namespace}-${local.service}"
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
* Database
***************************************/

module "postgres" {
  source               = "../../modules/kube_pg_cluster"
  eks_cluster_name     = var.eks_cluster_name
  public_outbound_ips  = var.public_outbound_ips
  kube_labels          = local.labels
  pg_cluster_name      = "${local.service}-pg"
  pg_cluster_namespace = local.namespace
  pg_instances         = var.pg_instances
  pg_storage_gb        = var.pg_storage_gb
  backups_force_delete = local.is_local
  backups_enabled      = !local.is_local
}

module "db_access" {
  source          = "../../modules/kube_sa_auth_pg"
  namespace       = local.namespace
  service_account = kubernetes_service_account.service.metadata[0].name
  database_role   = module.postgres.db_writer_role
  kube_labels     = local.labels
}

module "db_access_admin" {
  source          = "../../modules/kube_sa_auth_pg"
  namespace       = local.namespace
  service_account = kubernetes_service_account.service.metadata[0].name
  database_role   = module.postgres.db_admin_role
  kube_labels     = local.labels
}

/***************************************
* Deployment
***************************************/

resource "random_password" "cookie_signing_secret" {
  length = 32
}

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

  common_env = merge({
    NODE_ENV              = local.is_local ? "development" : "production"
    PG_HOSTNAME           = "${local.service}-pg-rw.${local.namespace}"
    PG_PORT               = "5432"
    PG_DATABASE           = "app"
    COOKIE_SIGNING_SECRET = random_password.cookie_signing_secret.result
    PUBLIC_URL            = "https://${var.ingress_domains[0]}${var.ingress_path_prefix}"
  }, var.environment_variables)

  // TODO: Separate init secrets from main container runtime
  dynamic_secrets = [{
    secret_provider_class = module.db_access_admin.secret_provider_class
    mount_path            = "/secrets/pg_creds"
    env_var               = "PG_CREDS_PATH"
  }]

  containers = concat([
    {
      name    = "server"
      image   = var.image_repo
      version = var.image_version
      command = local.is_local ? [
        "node_modules/.bin/nodemon",
        "--signal", "SIGTERM",
        "--delay", "0.25",
        "out/index.js"
      ] : ["node", "out/index.js"]
      minimum_memory = local.is_local ? 500 : 10
      env = {
        FUNCTION = "http-server"
      }
      healthcheck_type  = "HTTP"
      healthcheck_port  = local.port
      healthcheck_route = local.healthcheck_route
    }
    ], local.is_local ? [{
      name           = "init-compile"
      init           = true
      image          = var.image_repo
      version        = var.image_version
      command        = ["scripts/compile-dev.sh", "./out", "./tsconfig.json"]
      minimum_memory = 500
    }] : [],
    local.is_local ? [{
      name    = "compiler"
      image   = var.image_repo
      version = var.image_version
      command = [
        "node_modules/.bin/nodemon",
        "-x", "/bin/bash",
        "-w", "./src",
        "-w", "./scripts",
        "-e", "ts json sh js",
        "scripts/compile-dev.sh", "./out", "./tsconfig.json"
      ]
      minimum_memory = 500
    }] : [],
    !local.is_local ? [{
      name           = "migrate"
      init           = true
      image          = var.image_repo
      version        = var.image_version
      command        = ["node", "out/index.js"]
      minimum_memory = 10
      env = {
        FUNCTION = "db-migrate"
      }
    }] : []
  )

  tmp_directories = local.is_local ? {
    "/code/packages/primary-api/out" = {}
    "/tmp/build"                     = {}
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

  depends_on = [module.db_access]
}

module "ingress" {
  source = "../../modules/kube_ingress"

  namespace    = local.namespace
  kube_labels  = local.labels
  ingress_name = local.service

  ingress_configs = [{
    domains       = var.ingress_domains
    service       = module.deployment.service
    service_port  = local.port
    path_prefix   = var.ingress_path_prefix
    remove_prefix = true
  }]
}
