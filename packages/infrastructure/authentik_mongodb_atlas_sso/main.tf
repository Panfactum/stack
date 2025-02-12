terraform {
  required_providers {
    authentik = {
      source  = "goauthentik/authentik"
      version = "2024.8.4"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.34.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.1.3"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "4.0.6"
    }
  }
}

locals {
  combined_allowed_groups = toset([
    "superusers",
    "privileged_engineers",
    "engineers",
    "restricted_engineers",
    "billing_admins"], var.allowed_groups...)

  issuer = "https://${var.authentik_domain}"
}

###########################################################################
## Upload the logo
###########################################################################

resource "random_id" "logo" {
  prefix      = "mongodb-atlas-"
  byte_length = 8
}

resource "kubernetes_config_map_v1_data" "media" {
  metadata {
    name      = var.media_configmap
    namespace = var.authentik_namespace
  }
  data = {
    "${random_id.logo.hex}.svg" = file("${path.module}/mongodb.svg")
  }
  field_manager = random_id.logo.hex
  force         = true
}

###########################################################################
## Cert Config
###########################################################################

// These certs are only used for their random cryptographic
// material to sign the SAML assertions. There is no
// need to use cert-manager to manage them,
// especially since they need to be manually uploaded to atlas mongo
// every time they rotate
resource "tls_private_key" "signing" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "tls_self_signed_cert" "signing" {
  private_key_pem = tls_private_key.signing.private_key_pem
  subject {
    common_name  = var.authentik_domain
    organization = var.organization_name
  }
  validity_period_hours = 24 * 365 * 10
  allowed_uses = [
    "key_encipherment",
    "digital_signature",
    "server_auth",
  ]
}

resource "authentik_certificate_key_pair" "signing" {
  name             = "mongodb-atlas-signing-certs"
  certificate_data = tls_self_signed_cert.signing.cert_pem
  key_data         = tls_private_key.signing.private_key_pem
}

###########################################################################
## IdP Config
###########################################################################

resource "authentik_property_mapping_provider_saml" "member_of" {
  name       = "SAML MongoDB Atlas memberOf"
  saml_name  = "memberOf"
  expression = file("${path.module}/mapping.py")
}

data "authentik_flow" "default_authorization_flow" {
  slug = "default-provider-authorization-implicit-consent"
}

data "authentik_property_mapping_provider_saml" "email" {
  managed = "goauthentik.io/providers/saml/email"
}

resource "authentik_provider_saml" "mongodb_atlas" {
  name               = "mongodb-atlas"
  authorization_flow = data.authentik_flow.default_authorization_flow.id
  property_mappings = [
    authentik_property_mapping_provider_saml.member_of.id,
  ]
  acs_url            = var.acs_url
  sp_binding         = "post"
  issuer             = local.issuer
  audience           = var.audience
  name_id_mapping    = data.authentik_property_mapping_provider_saml.email.id
  signing_kp         = authentik_certificate_key_pair.signing.id
}

resource "authentik_application" "mongodb_atlas" {
  name              = "MongoDB Atlas"
  slug              = "mongodb-atlas"
  protocol_provider = authentik_provider_saml.mongodb_atlas.id
  meta_description  = var.ui_description
  meta_publisher    = "Panfactum"
  meta_icon         = "https://${var.authentik_domain}/media/public/${random_id.logo.hex}.svg"
  open_in_new_tab   = true
}

data "authentik_group" "superusers" {
  name = "superusers"
}

resource "authentik_policy_binding" "superuser_access" {
  target = authentik_application.mongodb_atlas.uuid
  group  = data.authentik_group.superusers.id
  order  = 0
}

data "authentik_group" "group" {
  for_each = local.combined_allowed_groups
  name     = each.key
}

resource "authentik_policy_binding" "access" {
  for_each = local.combined_allowed_groups
  target   = authentik_application.mongodb_atlas.uuid
  group    = data.authentik_group.group[each.key].id
  order    = 10
}

data "authentik_provider_saml_metadata" "mongodb_atlas" {
  provider_id = authentik_provider_saml.mongodb_atlas.id
}