terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
    }
    kubectl = {
      source  = "alekc/kubectl"
    }
    random = {
      source  = "hashicorp/random"
    }
    pf = {
      source = "panfactum/pf"
    }
  }
}

locals {
  domains = flatten([for domain in var.domains: [domain, "www.${domain}"]])
}

module "cdn" {
  source = "${var.pf_module_source}aws_cdn${var.pf_module_ref}"
  providers = {
    aws.global = aws.global
  }
  name = "email-domain-redirects"
  domains      = local.domains
  origin_configs = [{origin_domain = "panfactum.com"}]

  redirect_rules = [for domain in local.domains:{
      source = "https?://${domain}(/.*)"
      target = "https://panfactum.com$1"
      permanent = true
  }]
}

