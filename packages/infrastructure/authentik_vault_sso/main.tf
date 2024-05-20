terraform {
  required_providers {
    authentik = {
      source  = "goauthentik/authentik"
      version = "2024.2.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "4.0.5"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
  }
}


locals {
  redirect_uris = [
    "https://${var.vault_domain}/ui/vault/auth/oidc/oidc/callback",
    "https://${var.vault_domain}/oidc/callback",
    "http://localhost:8250/oidc/callback"
  ]
}

###########################################################################
## Cert Config
###########################################################################

// These certs are only used for their random cryptographic
// material to sign the SAML assertions. There is no
// need to use cert-manager to manage them,
// especially since they need to be manually uploaded to AWS
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
  name             = "${var.vault_name}-signing-certs"
  certificate_data = tls_self_signed_cert.signing.cert_pem
  key_data         = tls_private_key.signing.private_key_pem
}

###########################################################################
## Upload the logo
###########################################################################

resource "random_id" "logo" {
  prefix      = "vault-"
  byte_length = 8
}

resource "kubernetes_config_map_v1_data" "media" {
  metadata {
    name      = var.media_configmap
    namespace = var.authentik_namespace
  }
  data = {
    "/media/public/${random_id.logo.hex}.svg" = file("${path.module}/vault.svg")
  }
  field_manager = random_id.logo.hex
  force         = true
}

###########################################################################
## IdP Config
###########################################################################


resource "random_id" "client_id" {
  byte_length = 8
}

data "authentik_flow" "default-authorization-flow" {
  slug = "default-provider-authorization-implicit-consent"
}

data "authentik_scope_mapping" "profile" {
  managed = "goauthentik.io/providers/oauth2/scope-profile"
}

data "authentik_scope_mapping" "email" {
  managed = "goauthentik.io/providers/oauth2/scope-email"
}

data "authentik_scope_mapping" "openid" {
  managed = "goauthentik.io/providers/oauth2/scope-openid"
}


resource "authentik_provider_oauth2" "vault" {
  name               = var.vault_name
  authorization_flow = data.authentik_flow.default-authorization-flow.id
  client_id          = random_id.client_id.hex
  signing_key        = authentik_certificate_key_pair.signing.id
  redirect_uris      = local.redirect_uris
  property_mappings = sort([
    data.authentik_scope_mapping.profile.id,
    data.authentik_scope_mapping.email.id,
    data.authentik_scope_mapping.openid.id
  ])
}

resource "authentik_application" "vault" {
  name              = var.vault_name
  slug              = var.vault_name
  protocol_provider = authentik_provider_oauth2.vault.id
  meta_launch_url   = "https://${var.vault_domain}/ui/vault/auth?with=oidc"
  meta_description  = var.ui_description
  meta_publisher    = "Panfactum"
  meta_icon         = "${random_id.logo.hex}.svg"
  group             = var.ui_group
  open_in_new_tab   = true
}

data "authentik_group" "superusers" {
  name = "superusers"
}

resource "authentik_policy_binding" "superuser_access" {
  target = authentik_application.vault.uuid
  group  = data.authentik_group.superusers.id
  order  = 0
}


data "authentik_group" "group" {
  for_each = var.allowed_groups
  name     = each.key
}

resource "authentik_policy_binding" "access" {
  for_each = var.allowed_groups
  target   = authentik_application.vault.uuid
  group    = data.authentik_group.group[each.key].id
  order    = 10
}




