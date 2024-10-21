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
      source = "panfactum/pf"
      version = "0.0.3"
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
  source = "${var.pf_module_source}kube_constants${var.pf_module_ref}"
}

module "namespace" {
  source = "${var.pf_module_source}kube_namespace${var.pf_module_ref}"

  namespace = local.name
}

/***********************************************
* Website Deployment
************************************************/

module "website_deployment" {
  source = "${var.pf_module_source}kube_deployment${var.pf_module_ref}"
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

      ports = {
        http ={
          port = local.port
        }
      }
    }
  ]

  vpa_enabled = var.vpa_enabled
  controller_nodes_enabled = true
  instance_type_spread_required = true
}

module "ingress" {
  source = "${var.pf_module_source}kube_ingress${var.pf_module_ref}"

  name      = local.name
  namespace = local.namespace

  domains      = [var.website_domain, "www.${var.website_domain}"]
  ingress_configs = [{
    service      = local.name
    service_port = local.port
  }]

  cdn_mode_enabled = true
  cors_enabled                   = true
  cross_origin_embedder_policy   = "credentialless"
  csp_enabled                    = true
  cross_origin_isolation_enabled = true
  rate_limiting_enabled          = true
  permissions_policy_enabled     = true

  depends_on = [module.website_deployment]
}

module "cdn" {
  source = "${var.pf_module_source}kube_aws_cdn${var.pf_module_ref}"
  providers = {
    aws.global = aws.global
  }

  name           = "website"
  origin_shield_enabled = true
  origin_configs = module.ingress.cdn_origin_configs

  redirect_rules = [{
    source = "https?://www.panfactum.com(/.*)"
    target = "https://panfactum.com$1"
    permanent = true
  }]
}

