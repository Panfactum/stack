terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.10"
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "2.41.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.22"
    }
  }
}

locals {
  name               = "${var.eks_cluster_name}-${var.service_account_namespace}-${var.service_account}"
  description        = "Permissions for the ${var.service_account} service account in the ${var.service_account_namespace} namespace in the ${var.eks_cluster_name} cluster"
  kube_oidc_provider = data.aws_eks_cluster.cluster.identity[0].oidc[0].issuer

  sp_groups = toset(var.service_principal_groups)
}

data "aws_caller_identity" "main" {}
data "aws_region" "main" {}
data "aws_eks_cluster" "cluster" {
  name = var.eks_cluster_name
}


# ################################################################################
# AAD Setup
# ################################################################################

data "azuread_application_published_app_ids" "well_known" {}

resource "azuread_service_principal" "msgraph" {
  application_id = data.azuread_application_published_app_ids.well_known.result.MicrosoftGraph
  use_existing   = true
}

resource "azuread_application" "main" {
  display_name = "${var.eks_cluster_name}-${var.service_account_namespace}-${var.service_account}"
  description  = local.description
  owners       = var.aad_sp_object_owners

  required_resource_access {
    resource_app_id = data.azuread_application_published_app_ids.well_known.result.MicrosoftGraph
    dynamic "resource_access" {
      for_each = var.msgraph_roles
      content {
        id   = azuread_service_principal.msgraph.app_role_ids[resource_access.key]
        type = "Role"
      }
    }
  }
}

resource "azuread_application_federated_identity_credential" "main" {
  application_object_id = azuread_application.main.object_id
  display_name          = local.name
  description           = local.description
  audiences             = ["api://AzureADTokenExchange"]
  issuer                = local.kube_oidc_provider
  subject               = "system:serviceaccount:${var.service_account_namespace}:${var.service_account}"
}

# ################################################################################
# AAD Permissions
# ################################################################################

resource "azuread_service_principal" "main" {
  application_id               = azuread_application.main.application_id
  app_role_assignment_required = false
  owners                       = var.aad_sp_object_owners
}

resource "azuread_app_role_assignment" "main" {
  for_each            = var.msgraph_roles
  app_role_id         = azuread_service_principal.msgraph.app_role_ids[each.key]
  principal_object_id = azuread_service_principal.main.object_id
  resource_object_id  = azuread_service_principal.msgraph.object_id
}

data "azuread_group" "main" {
  for_each     = var.service_principal_groups
  display_name = each.key
}

resource "azuread_group_member" "main" {
  for_each         = var.service_principal_groups
  group_object_id  = data.azuread_group.main[each.key].object_id
  member_object_id = azuread_service_principal.main.object_id
}

# ################################################################################
# IP Whitelisting for service principal
# ################################################################################

resource "azuread_named_location" "main" {
  display_name = "${var.eks_cluster_name}-${var.service_account_namespace}-${local.name}"
  ip {
    ip_ranges = [for ip in var.ip_allow_list : "${ip}/32"]
  }
}

resource "azuread_conditional_access_policy" "main" {
  display_name = "${var.eks_cluster_name}-${var.service_account_namespace}-${local.name}"
  state        = "enabled"
  conditions {
    client_app_types = ["all"]
    client_applications {
      included_service_principals = [azuread_service_principal.main.object_id]
    }
    users {
      included_users = ["None"]
    }
    locations {
      included_locations = ["All"]
      excluded_locations = [azuread_named_location.main.id]
    }
    applications {
      included_applications = ["All"]
    }
  }
  grant_controls {
    built_in_controls = ["block"]
    operator          = "OR"
  }
}

# ################################################################################
# Provide the annotation required by IRSA
# ################################################################################

resource "kubernetes_annotations" "service_account" {
  count       = var.annotate_service_account ? 1 : 0
  api_version = "v1"
  kind        = "ServiceAccount"
  metadata {
    name      = var.service_account
    namespace = var.service_account_namespace
  }
  field_manager = "terraform-aad"
  force         = true
  annotations = {
    "azure.workload.identity/client-id" = azuread_application.main.application_id
  }
}
