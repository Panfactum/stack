terraform {
  required_providers {
    mongodbatlas = {
      source  = "mongodb/mongodbatlas"
      version = "1.26.1"
    }

    authentik = {
      source  = "goauthentik/authentik"
      version = "2024.8.4"
    }
  }
}

locals {
  default_role_mappings = {
    "superusers"            = ["ORG_OWNER"]
    "billing_admins"        = ["ORG_BILLING_ADMIN"]
    "privileged_engineers"  = ["ORG_GROUP_CREATOR", "ORG_READ_ONLY"]
    "engineers"             = ["ORG_READ_ONLY"]
    "restricted_engineers"  = ["ORG_MEMBER"]
  }

  # Filter out keys that attempt to override default mappings
  allowed_custom_mappings = {
    for key, roles in var.custom_role_mappings :
    key => roles if !contains(keys(local.default_role_mappings), key)
  }

  # Final role mappings (default + only new custom mappings)
  role_mappings = merge(local.default_role_mappings, local.allowed_custom_mappings)

  # List of valid Authentik group names
  authentik_group_names = [for group in data.authentik_groups.all.groups : group.name]

  # Identify invalid groups (ones that do NOT exist in Authentik)
  invalid_role_mappings = {
    for key, roles in local.role_mappings :
    key => roles if !contains(local.authentik_group_names, key)
  }

  # Valid role mappings (excluding invalid groups)
  valid_role_mappings = {
    for key, roles in local.role_mappings :
    key => roles if contains(local.authentik_group_names, key)
  }
}



resource "mongodbatlas_federated_settings_identity_provider" "identity_provider" {
  federation_settings_id       = var.federation_settings_id
  name                         = var.name
  associated_domains           = var.associated_domains
  sso_debug_enabled            = var.sso_debug_enabled
  status                       = var.active ? "ACTIVE" : "INACTIVE"
  sso_url                      = var.sso_url
  issuer_uri                   = var.issuer_url
  request_binding              = "HTTP-POST"
  response_signature_algorithm = "SHA-256"
}

import {
  to = mongodbatlas_federated_settings_identity_provider.identity_provider
  id = "${var.federation_settings_id}-${var.idp_id}"
}

data "mongodbatlas_federated_settings_identity_provider" "identity_provider_ds" {
  federation_settings_id = var.federation_settings_id
  identity_provider_id   = var.idp_id
}

data "authentik_groups" "all" {}

# 🚨 Error out if there are invalid group mappings
resource "null_resource" "invalid_group_check" {
  count = length(local.invalid_role_mappings) > 0 ? 1 : 0

  provisioner "local-exec" {
    command = "echo 'ERROR: The following Authentik groups do not exist: ${join(", ", keys(local.invalid_role_mappings))}' && exit 1"
  }
}

resource "mongodbatlas_federated_settings_org_role_mapping" "role_mapping" {
  for_each = local.valid_role_mappings

  external_group_name    = each.key
  federation_settings_id = var.federation_settings_id
  org_id                 = var.organization_id

  role_assignments {
    org_id = var.organization_id
    roles  = each.value
  }
}