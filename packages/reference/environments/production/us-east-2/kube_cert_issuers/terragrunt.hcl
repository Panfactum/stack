include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = "github.com/Panfactum/stack.git?ref=main/packages/terraform//kube_cert_issuers"
}

dependency "cert_manager" {
  config_path  = "../kube_cert_manager"
  skip_outputs = true
}

dependency "aws_eks" {
  config_path = "../aws_eks"
}

dependency "vault_core" {
  config_path  = "../vault_core_resources"
  skip_outputs = true
}

dependency "vault" {
  config_path = "../kube_vault"
}

dependency "registered_domains" {
  config_path = "../../global/aws_registered_domains"
}

dependency "delegated_zones" {
  config_path = "../../global/aws_delegated_zones_production"
}

inputs = {
  alert_email        = "it@panfactum.com"
  eks_cluster_name   = dependency.aws_eks.outputs.cluster_name
  vault_internal_url = dependency.vault.outputs.vault_internal_url

  route53_zones = {
    "prod.panfactum.com" = {
      zone_id                 = dependency.delegated_zones.outputs.zones["prod.panfactum.com"].zone_id
      record_manager_role_arn = dependency.delegated_zones.outputs.record_manager_role_arn
    }
    "production.panfactum.com" = {
      zone_id                 = dependency.delegated_zones.outputs.zones["production.panfactum.com"].zone_id
      record_manager_role_arn = dependency.delegated_zones.outputs.record_manager_role_arn
    }
    "panfactum.com" = {
      zone_id                 = dependency.registered_domains.outputs.zones["panfactum.com"].zone_id
      record_manager_role_arn = dependency.registered_domains.outputs.record_manager_role_arn
    }
  }
}


