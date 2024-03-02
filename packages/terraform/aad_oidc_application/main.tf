terraform {
  required_providers {
    azuread = {
      source  = "hashicorp/azuread"
      version = "2.41.0"
    }
    time = {
      source  = "hashicorp/time"
      version = "0.9.1"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.5.1"
    }
  }
}

/***************************************
* Setup AAD Application for User Auth
***************************************/

resource "azuread_application" "oidc" {
  display_name = var.display_name
  description  = var.description
  web {
    redirect_uris = var.redirect_uris
    implicit_grant {
      access_token_issuance_enabled = true
      id_token_issuance_enabled     = true
    }
  }

  // Required access to the microsoft graph api (required to get the claims)
  // See terraform docs for how to find this
  // https://registry.terraform.io/providers/hashicorp/azuread/latest/docs/resources/application
  required_resource_access {
    resource_app_id = "00000003-0000-0000-c000-000000000000"

    // email address access
    resource_access {
      id   = "64a6cdd6-aab1-4aaf-94b8-3cc8405e90d0"
      type = "Scope"
    }

    // basic profile access
    resource_access {
      id   = "14dad69e-099b-42c9-810b-d002981feec1"
      type = "Scope"
    }

    // Allows you to sign in
    resource_access {
      id   = "e1fe6dd8-ba31-4d61-89e7-88639da4683d"
      type = "Scope"
    }
  }

  group_membership_claims = ["SecurityGroup"]
}

resource "time_rotating" "client_secret" {
  rotation_days = 30
}

resource "azuread_application_password" "oidc" {
  display_name          = "main"
  application_object_id = azuread_application.oidc.object_id
  rotate_when_changed = {
    time = time_rotating.client_secret.id
  }
}

resource "azuread_service_principal" "oidc" {
  application_id = azuread_application.oidc.application_id
}

resource "azuread_app_role_assignment" "groups" {
  for_each            = toset(var.group_object_ids)
  app_role_id         = "00000000-0000-0000-0000-000000000000"
  principal_object_id = each.key
  resource_object_id  = azuread_service_principal.oidc.object_id
}
