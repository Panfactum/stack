terraform {
  required_providers {
    mongodbatlas = {
      source  = "mongodb/mongodbatlas"
      version = "1.26.1"
    }
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

resource "mongodbatlas_federated_settings_org_role_mapping" "owner" {
  for_each = toset(concat(var.member_groups, ["superusers"]))
  external_group_name    = each.key

  federation_settings_id = var.federation_settings_id
  org_id                 = var.organization_id

  role_assignments {
    org_id = var.organization_id

    # "ORG_MEMBER","ORG_GROUP_CREATOR","ORG_BILLING_ADMIN", "ORG_OWNER
    # https://www.mongodb.com/docs/atlas/reference/user-roles/
    roles     = ["ORG_OWNER"]
  }
}

resource "mongodbatlas_federated_settings_org_role_mapping" "project_creator" {
  for_each = toset(concat(var.member_groups, []))
  external_group_name    = each.key

  federation_settings_id = var.federation_settings_id
  org_id                 = var.organization_id

  role_assignments {
    org_id = var.organization_id

    # "ORG_MEMBER","ORG_GROUP_CREATOR","ORG_BILLING_ADMIN", "ORG_OWNER
    # https://www.mongodb.com/docs/atlas/reference/user-roles/
    roles     = ["ORG_GROUP_CREATOR"]
  }
}

resource "mongodbatlas_federated_settings_org_role_mapping" "billing_admin" {
  for_each = toset(concat(var.member_groups, ["billing_admins"]))
  external_group_name    = each.key

  federation_settings_id = var.federation_settings_id
  org_id                 = var.organization_id

  role_assignments {
    org_id = var.organization_id

    # "ORG_MEMBER","ORG_GROUP_CREATOR","ORG_BILLING_ADMIN", "ORG_OWNER
    # https://www.mongodb.com/docs/atlas/reference/user-roles/
    roles     = ["ORG_BILLING_ADMIN"]
  }
}

resource "mongodbatlas_federated_settings_org_role_mapping" "billing_viewer" {
  for_each = toset(concat(var.member_groups, []))
  external_group_name    = each.key

  federation_settings_id = var.federation_settings_id
  org_id                 = var.organization_id

  role_assignments {
    org_id = var.organization_id

    # "ORG_MEMBER","ORG_GROUP_CREATOR","ORG_BILLING_ADMIN", "ORG_OWNER
    # https://www.mongodb.com/docs/atlas/reference/user-roles/
    roles     = ["ORG_BILLING_READ_ONLY"]
  }
}

resource "mongodbatlas_federated_settings_org_role_mapping" "read_only" {
  for_each = toset(concat(var.member_groups, ["privileged_engineers"]))
  external_group_name    = each.key

  federation_settings_id = var.federation_settings_id
  org_id                 = var.organization_id

  role_assignments {
    org_id = var.organization_id
    roles     = ["ORG_READ_ONLY"]
  }
}

resource "mongodbatlas_federated_settings_org_role_mapping" "member" {
  for_each = toset(concat(var.member_groups, ["restricted_engineers", "engineers"]))
  external_group_name    = each.key

  federation_settings_id = var.federation_settings_id
  org_id                 = var.organization_id

  role_assignments {
    org_id = var.organization_id
    roles     = ["ORG_MEMBER"]
  }
}