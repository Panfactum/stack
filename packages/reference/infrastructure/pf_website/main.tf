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

module "website" {
  source = "${var.pf_module_source}aws_s3_public_website${var.pf_module_ref}"
  providers = {
    aws.global = aws.global
  }
  bucket_name = "pf-website-astro"
  description = "Hosts the new Astro Panfactum website"
  domains      = ["panfactum.com", "www.panfactum.com"]

  redirect_rules = [{
    source = "https?://www.panfactum.com(/.*)"
    target = "https://panfactum.com$1"
    permanent = true
  }]
}

