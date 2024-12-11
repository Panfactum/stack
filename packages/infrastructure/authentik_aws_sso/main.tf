terraform {
  required_providers {
    authentik = {
      source  = "goauthentik/authentik"
      version = "2024.6.1"
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


###########################################################################
## Upload the logo
###########################################################################

resource "random_id" "logo" {
  prefix      = "aws-"
  byte_length = 8
}

resource "kubernetes_config_map_v1_data" "media" {
  metadata {
    name      = var.media_configmap
    namespace = var.authentik_namespace
  }
  data = {
    "${random_id.logo.hex}.svg" = file("${path.module}/aws.svg")
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
  name             = "aws-signing-certs"
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

resource "authentik_provider_saml" "aws" {
  name               = "aws"
  authorization_flow = data.authentik_flow.default-authorization-flow.id
  acs_url            = var.aws_acs_url
  sp_binding         = "post"
  issuer             = var.aws_issuer
  audience           = var.aws_issuer
  name_id_mapping    = data.authentik_property_mapping_saml.email.id
  signing_kp         = authentik_certificate_key_pair.signing.id
}

data "authentik_provider_saml_metadata" "aws" {
  provider_id = authentik_provider_saml.aws.id
}

data "authentik_property_mapping_scim" "group" {
  managed = "goauthentik.io/providers/scim/group"
}

// We need to use a custom mapping because we need to make the email the username
// in order to work with AWS
resource "authentik_property_mapping_scim" "aws" {
  expression = file("${path.module}/mapping.py")
  name       = "AWS SCIM Mapping"
}

resource "authentik_provider_scim" "aws" {
  count                         = var.aws_scim_enabled ? 1 : 0
  name                          = "aws-scim"
  url                           = var.aws_scim_url
  token                         = var.aws_scim_token
  exclude_users_service_account = true
  property_mappings             = [authentik_property_mapping_scim.aws.id]
  property_mappings_group       = [data.authentik_property_mapping_scim.group.id]
}

resource "authentik_application" "aws" {
  name              = "aws"
  slug              = "aws"
  protocol_provider = authentik_provider_saml.aws.id
  meta_launch_url   = var.aws_sign_in_url
  meta_description  = var.ui_description
  meta_publisher    = "Panfactum"
  meta_icon         = "https://${var.authentik_domain}/media/public/${random_id.logo.hex}.svg"
  group             = var.ui_group
  open_in_new_tab   = true
  backchannel_providers = var.aws_scim_enabled ? [
    authentik_provider_scim.aws[0].id
  ] : []
}

data "authentik_group" "superusers" {
  name = "superusers"
}

resource "authentik_policy_binding" "superuser_access" {
  target = authentik_application.aws.uuid
  group  = data.authentik_group.superusers.id
  order  = 0
}

data "authentik_group" "group" {
  for_each = var.allowed_groups
  name     = each.key
}

resource "authentik_policy_binding" "access" {
  for_each = var.allowed_groups
  target   = authentik_application.aws.uuid
  group    = data.authentik_group.group[each.key].id
  order    = 10
}




