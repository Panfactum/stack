terraform {
  required_providers {
    kubernetes = {
      source = "hashicorp/kubernetes"
    }
    kubectl = {
      source = "alekc/kubectl"
    }
    random = {
      source = "hashicorp/random"
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
  domains     = [var.website_domain]
}

module "installer" {
  source = "${var.pf_module_source}aws_s3_public_website${var.pf_module_ref}"
  providers = {
    aws.global = aws.global
  }
  bucket_name = "pf-framework-installer"
  description = "Hosts the Panfactum installer scripts"
  domains     = ["install.panfactum.com"]
}
