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

inputs = {
  alert_email        = "it@panfactum.com"
  eks_cluster_name   = dependency.aws_eks.outputs.cluster_name
  vault_internal_url = dependency.vault.outputs.vault_internal_url

  route53_zones = {

    // These came from the aws_delegated_zones_production module (defined in the management account)
    "prod.panfactum.com" = {
      zone_id                 = "Z104786282Q7IOIV925D"
      record_manager_role_arn = "arn:aws:iam::891377197483:role/route53-record-manager-20240313214126583800000002"
    }
    "production.panfactum.com" = {
      zone_id                 = "Z03883631H5FU6QG7GIRC"
      record_manager_role_arn = "arn:aws:iam::891377197483:role/route53-record-manager-20240313214126583800000002"
    }

    // Note that this hosted zone is the root domain so it is in the management account
    // under aws_registered_domains.
    //
    // Make sure you provide the production account id to the `additional_account_ids_with_record_access` input
    // to that module to allow the production account to access this role
    "panfactum.com" = {
      zone_id                 = "Z0647021SA79T1775S78"
      record_manager_role_arn = "arn:aws:iam::143003111016:role/route53-record-manager-20240313213835573400000002"
    }
  }
}


