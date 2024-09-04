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
  source = "../../../../../infrastructure//kube_constants" #pf-update
}

module "namespace" {
  source = "../../../../../infrastructure//kube_namespace" #pf-update

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
  source = "../../../../../infrastructure//kube_deployment" #pf-update
  namespace = module.namespace.namespace
  name      = local.name

  replicas                             = 2

  common_env = {
    NODE_ENV = "production"
    PORT     = local.port
    HOSTNAME = "0.0.0.0"
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

resource "kubernetes_service" "service" {
  metadata {
    name      = local.name
    namespace = local.namespace
    labels    = module.website_deployment.labels
  }
  spec {
    internal_traffic_policy = "Cluster"
    ip_families             = ["IPv4"]
    ip_family_policy        = "SingleStack"
    selector                = module.website_deployment.match_labels
    port {
      name        = "http"
      port        = local.port
      protocol    = "TCP"
      target_port = local.port
    }
  }

  depends_on = [module.website_deployment]
}

module "ingress" {
  source = "../../../../../infrastructure//kube_ingress" #pf-update

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

  depends_on = [kubernetes_service.service]
}
