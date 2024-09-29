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

locals {
  name      = "website"
  namespace = module.namespace.namespace

  port              = 3000
  healthcheck_route = "/"
}

module "constants" {
  source = "github.com/Panfactum/stack.git//packages/infrastructure/kube_constants?ref=e7bce6f03ec62851b2ca375337dd01253a84482d" #pf-update
}

module "namespace" {
  source = "github.com/Panfactum/stack.git//packages/infrastructure/kube_namespace?ref=e7bce6f03ec62851b2ca375337dd01253a84482d" #pf-update

  namespace = local.name

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

/***********************************************
* Website Deployment
************************************************/

module "website_deployment" {
  source = "github.com/Panfactum/stack.git//packages/infrastructure/kube_deployment?ref=e7bce6f03ec62851b2ca375337dd01253a84482d" #pf-update
  namespace = module.namespace.namespace
  name      = local.name

  replicas                             = 2

  common_env = {
    NODE_ENV = "production"
    PORT     = local.port
    HOSTNAME = "0.0.0.0"
    NEXT_PUBLIC_ALGOLIA_APP_ID = var.algolia_app_id
    NEXT_PUBLIC_ALGOLIA_INDEX_NAME = var.algolia_index_name
    NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY = var.algolia_search_api_key
  }

  containers = [
    {
      name    = "website"
      image_registry   = "891377197483.dkr.ecr.us-east-2.amazonaws.com"
      image_repository = "website"
      image_tag = var.website_image_version
      command = [
        "node",
        "server.js"
      ]
      liveness_probe_type  = "HTTP"
      liveness_probe_port  = local.port
      liveness_probe_route = local.healthcheck_route

      ports = {
        http ={
          port = local.port
        }
      }
    }
  ]

  vpa_enabled = var.vpa_enabled
  controller_nodes_enabled = true

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

module "ingress" {
  source = "github.com/Panfactum/stack.git//packages/infrastructure/kube_ingress?ref=e7bce6f03ec62851b2ca375337dd01253a84482d" #pf-update

  name      = local.name
  namespace = local.namespace

  ingress_configs = [{
    domains      = [var.website_domain]
    service      = local.name
    service_port = local.port
  }]

  cors_enabled                   = true
  cross_origin_embedder_policy   = "credentialless"
  csp_enabled                    = true
  cross_origin_isolation_enabled = true
  rate_limiting_enabled          = true
  permissions_policy_enabled     = true

  # pf-generate: pass_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate

  depends_on = [module.website_deployment]
}
