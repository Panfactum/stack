terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.10"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.7"
    }
  }
}

locals {
  all_role_groups = toset(concat(var.superuser_groups, var.admin_groups, var.reader_groups))
}

###########################################################################
## Group Lookups
###########################################################################

data "aws_identitystore_group" "groups" {
  for_each          = local.all_role_groups
  identity_store_id = var.identity_store_id
  alternate_identifier {
    unique_attribute {
      attribute_path  = "DisplayName"
      attribute_value = each.value
    }
  }
}

###########################################################################
## AWS RBAC Core Permission Sets and Assignments
###########################################################################

######################### Superuser #######################################

resource "aws_ssoadmin_account_assignment" "superuser" {
  for_each = toset(var.superuser_groups)

  instance_arn       = var.sso_instance_arn
  permission_set_arn = var.superuser_permission_set_arn

  principal_id   = data.aws_identitystore_group.groups[each.value].group_id
  principal_type = "GROUP"

  target_id   = var.aws_account_id
  target_type = "AWS_ACCOUNT"
}

######################### Admin #######################################

resource "aws_ssoadmin_account_assignment" "admin" {
  for_each = toset(var.admin_groups)

  instance_arn       = var.sso_instance_arn
  permission_set_arn = var.admin_permission_set_arn

  principal_id   = data.aws_identitystore_group.groups[each.value].group_id
  principal_type = "GROUP"

  target_id   = var.aws_account_id
  target_type = "AWS_ACCOUNT"

  lifecycle {
    prevent_destroy = true
  }
}

######################### Reader #######################################

resource "aws_ssoadmin_account_assignment" "reader" {
  for_each = toset(var.reader_groups)

  instance_arn       = var.sso_instance_arn
  permission_set_arn = var.reader_permission_set_arn

  principal_id   = data.aws_identitystore_group.groups[each.value].group_id
  principal_type = "GROUP"

  target_id   = var.aws_account_id
  target_type = "AWS_ACCOUNT"

  lifecycle {
    prevent_destroy = true
  }
}
