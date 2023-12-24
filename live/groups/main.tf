terraform {
  required_providers {
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 2.15"
    }
  }
}

locals {
  azure_roles = toset(concat(
    flatten([for _, config in var.role_group_config : config.azure_roles]),
    ["Application Developer", "Global Reader", "Global Administrator", "Conditional Access Administrator"]
  ))

  role_assignments_list = flatten([for name, config in var.role_group_config : [
    for role in config.azure_roles : { group = name, role = role }
  ]])
  role_assignments = { for config in local.role_assignments_list : "${config.group}-${config.role}" => config }
}

###########################################################################
## Azure Roles
###########################################################################

resource "azuread_directory_role" "roles" {
  for_each     = local.azure_roles
  display_name = each.key
}

###########################################################################
## Azure AD Group Creation
###########################################################################

resource "azuread_group" "role_groups" {
  for_each                = var.role_group_config
  display_name            = "rbac_${each.key}"
  description             = each.value.description
  security_enabled        = true
  prevent_duplicate_names = true
  visibility              = "Private"
  assignable_to_role      = true
  lifecycle {
    ignore_changes = [members]
  }
}

resource "azuread_directory_role_assignment" "role_groups" {
  for_each            = local.role_assignments
  role_id             = azuread_directory_role.roles[each.value.role].template_id
  principal_object_id = azuread_group.role_groups[each.value.group].object_id
}

resource "azuread_group" "dynamic_groups" {
  for_each                = var.dynamic_group_config
  display_name            = each.key
  description             = each.value.description
  security_enabled        = true
  mail_enabled            = each.value.mail_nickname != null
  mail_nickname           = each.value.mail_nickname
  prevent_duplicate_names = true
  types                   = concat(["DynamicMembership"], each.value.mail_nickname == null ? [] : ["Unified"])
  visibility              = "Private"
  dynamic_membership {
    enabled = true
    rule    = "user.memberof -any (group.objectId -in [${join(", ", [for group in each.value.role_groups : "'${azuread_group.role_groups[group].object_id}'"])}])"
  }
  depends_on = [azuread_group.role_groups]
}

resource "azuread_group" "ci_group_config" {
  for_each                = var.ci_group_config
  display_name            = "ci_${each.key}"
  description             = "Group for CI agents in ${each.key}"
  security_enabled        = true
  prevent_duplicate_names = true
  visibility              = "Private"
  assignable_to_role      = true
  lifecycle {
    ignore_changes = [members]
  }
}

resource "azuread_directory_role_assignment" "ci_group_admins" {
  for_each            = { for group, config in var.ci_group_config : group => config if config.global_admin }
  role_id             = azuread_directory_role.roles["Global Administrator"].template_id
  principal_object_id = azuread_group.ci_group_config[each.key].object_id
}

// All CI users are automatically app developers so they can create apps
resource "azuread_directory_role_assignment" "ci_group_app_developers" {
  for_each            = var.ci_group_config
  role_id             = azuread_directory_role.roles["Application Developer"].template_id
  principal_object_id = azuread_group.ci_group_config[each.key].object_id
}

// All CI users have read access to the entire AAD directory
resource "azuread_directory_role_assignment" "ci_group_global_readers" {
  for_each            = var.ci_group_config
  role_id             = azuread_directory_role.roles["Global Reader"].template_id
  principal_object_id = azuread_group.ci_group_config[each.key].object_id
}

// All CI users have the ability to change conditional access parameters for ip blocks
resource "azuread_directory_role_assignment" "ci_group_global_conditional_access_admin" {
  for_each            = var.ci_group_config
  role_id             = azuread_directory_role.roles["Conditional Access Administrator"].template_id
  principal_object_id = azuread_group.ci_group_config[each.key].object_id
}

###########################################################################
## TODO: Group setup in google for membership + mailing list settings
###########################################################################
