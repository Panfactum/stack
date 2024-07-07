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
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "4.0.5"
    }
  }
}


###########################################################################
## Upload the logo
###########################################################################

resource "random_id" "logo" {
  prefix      = "zoho-"
  byte_length = 8
}

resource "kubernetes_config_map_v1_data" "media" {
  metadata {
    name      = var.media_configmap
    namespace = var.authentik_namespace
  }
  data = {
    "${random_id.logo.hex}.svg" = file("${path.module}/zoho.svg")
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
  name             = "zoho-signing-certs"
  certificate_data = tls_self_signed_cert.signing.cert_pem
  key_data         = tls_private_key.signing.private_key_pem
}

###########################################################################
## IdP Config
###########################################################################


data "authentik_flow" "default-authorization-flow" {
  slug = "default-provider-authorization-implicit-consent"
}

data "authentik_property_mapping_saml" "email" {
  managed = "goauthentik.io/providers/saml/email"
}

resource "authentik_provider_saml" "zoho" {
  name               = "zoho"
  authorization_flow = data.authentik_flow.default-authorization-flow.id
  acs_url            = var.zoho_acs_url
  sp_binding         = "post"
  issuer             = var.zoho_issuer
  name_id_mapping    = data.authentik_property_mapping_saml.email.id
  signing_kp         = authentik_certificate_key_pair.signing.id
}

data "authentik_provider_saml_metadata" "zoho" {
  provider_id = authentik_provider_saml.zoho.id
}


resource "authentik_application" "zoho" {
  name              = "zoho"
  slug              = "zoho"
  protocol_provider = authentik_provider_saml.zoho.id
  meta_launch_url   = var.zoho_sign_in_url
  meta_description  = var.ui_description
  meta_publisher    = "Panfactum"
  meta_icon         = "https://${var.authentik_domain}/media/public/${random_id.logo.hex}.svg"
  group             = var.ui_group
  open_in_new_tab   = true
}


data "authentik_group" "superusers" {
  name = "superusers"
}

resource "authentik_policy_binding" "superuser_access" {
  target = authentik_application.zoho.uuid
  group  = data.authentik_group.superusers.id
  order  = 0
}


data "authentik_group" "group" {
  for_each = var.allowed_groups
  name     = each.key
}

resource "authentik_policy_binding" "access" {
  for_each = var.allowed_groups
  target   = authentik_application.zoho.uuid
  group    = data.authentik_group.group[each.key].id
  order    = 10
}




