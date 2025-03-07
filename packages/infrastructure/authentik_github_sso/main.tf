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
  "billing_admins"], var.extra_allowed_groups...)

  issuer = "https://${var.authentik_domain}"
}

###########################################################################
## Upload the logo
###########################################################################

resource "random_id" "logo" {
  prefix      = "github-"
  byte_length = 8
}

resource "kubernetes_config_map_v1_data" "media" {
  metadata {
    name      = var.media_configmap
    namespace = var.authentik_namespace
  }
  data = {
    "${random_id.logo.hex}.svg" = file("${path.module}/github.svg")
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
// especially since they need to be manually uploaded to github
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
  name             = "github-signing-certs"
  certificate_data = tls_self_signed_cert.signing.cert_pem
  key_data         = tls_private_key.signing.private_key_pem
}

###########################################################################
## IdP Config
###########################################################################

data "authentik_flow" "default_authorization_flow" {
  slug = "default-provider-authorization-implicit-consent"
}

data "authentik_property_mapping_provider_saml" "email" {
  managed = "goauthentik.io/providers/saml/email"
}

resource "authentik_provider_saml" "github" {
  name               = "github"
  authorization_flow = data.authentik_flow.default_authorization_flow.id
  property_mappings  = [data.authentik_property_mapping_provider_saml.email.id]
  acs_url            = var.acs_url
  sp_binding         = "post"
  issuer             = local.issuer
  audience           = replace(var.acs_url, "/saml/consume", "")
  name_id_mapping    = data.authentik_property_mapping_provider_saml.email.id
  signing_kp         = authentik_certificate_key_pair.signing.id
}

resource "null_resource" "wait_for_saml_provider" {
  depends_on = [authentik_provider_saml.github]

  provisioner "local-exec" {
    command = "sleep 10" # Give the API time to fully create the resource
  }
}

resource "authentik_application" "github" {
  name              = "GitHub"
  slug              = "github"
  protocol_provider = authentik_provider_saml.github.id
  meta_description  = var.ui_description
  meta_publisher    = "Panfactum"
  meta_icon         = "https://${var.authentik_domain}/media/public/${random_id.logo.hex}.svg"
  open_in_new_tab   = true
}

data "authentik_group" "group" {
  for_each = local.combined_allowed_groups
  name     = each.key
}

resource "authentik_policy_binding" "access" {
  for_each = local.combined_allowed_groups
  target   = authentik_application.github.uuid
  group    = data.authentik_group.group[each.key].id
  order    = 10
}

data "authentik_provider_saml_metadata" "github" {
  provider_id = authentik_provider_saml.github.id
}