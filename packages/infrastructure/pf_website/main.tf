// Live

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
  }
}

locals {
  name      = "website"
  namespace = module.namespace.namespace

  port              = 3000
  healthcheck_route = "/"
}

module "labels" {
  source = "../kube_labels"

  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
}

module "constants" {
  source = "../constants"

  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
}

module "namespace" {
  source = "../kube_namespace"

  namespace            = local.name
  linkerd_inject       = false
  loadbalancer_enabled = true

  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
}

/***********************************************
* Website Deployment
************************************************/

module "website_deployment" {
  source       = "../kube_deployment"
  namespace    = module.namespace.namespace
  service_name = local.name

  min_replicas = 2
  max_replicas = 2
  tolerations  = module.constants.burstable_node_toleration_helm


  common_env = {
    NODE_ENV = "production"
    PORT     = local.port
    HOSTNAME = "0.0.0.0"
  }

  containers = [
    {
      name    = "website"
      image   = "891377197483.dkr.ecr.us-east-2.amazonaws.com/website"
      version = var.website_image_version
      command = [
        "node",
        "server.js"
      ]
      healthcheck_type  = "HTTP"
      healthcheck_port  = local.port
      healthcheck_route = local.healthcheck_route
    }
  ]

  ports = {
    http = {
      pod_port     = local.port
      service_port = local.port
    }
  }

  vpa_enabled = var.vpa_enabled

  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
}

module "ingress" {
  source = "../kube_ingress"

  name      = local.name
  namespace = local.namespace

  ingress_configs = [{
    domains      = [var.website_domain]
    service      = module.website_deployment.service
    service_port = local.port
  }]

  cors_enabled                   = true
  csp_enabled                    = true
  cross_origin_isolation_enabled = true
  rate_limiting_enabled          = true
  permissions_policy_enabled     = true

  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
}