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
  sso_instance_arn  = tolist(data.aws_ssoadmin_instances.main.arns)[0]
  identity_store_id = tolist(data.aws_ssoadmin_instances.main.identity_store_ids)[0]
}

data "aws_ssoadmin_instances" "main" {}

module "aws_core_permissions" {
  source                  = "../../modules/aws_core_permissions"
  protected_dynamodb_arns = var.protected_dynamodb_arns
  protected_kms_arns      = var.protected_kms_arns
  protected_s3_arns       = var.protected_s3_arns
}

###########################################################################
## AWS RBAC Core Permission Sets
###########################################################################

######################### Superuser #######################################
resource "aws_ssoadmin_permission_set" "superuser" {
  name         = "Superuser"
  description  = "Complete access to the account."
  instance_arn = local.sso_instance_arn
  tags = {
    description = "Complete access to the account."
  }
}

resource "aws_ssoadmin_managed_policy_attachment" "superuser" {
  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.superuser.arn
  managed_policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

######################### Admin #######################################

resource "aws_ssoadmin_permission_set" "admin" {
  name         = "Admin"
  description  = "Read and write access to most resources."
  instance_arn = local.sso_instance_arn
  tags = {
    description = "Read and write access to most resources."
  }
}

resource "aws_ssoadmin_permission_set_inline_policy" "admin" {
  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.admin.arn
  inline_policy      = module.aws_core_permissions.admin_policy_json
}

######################### Reader #######################################

resource "aws_ssoadmin_permission_set" "reader" {
  name         = "Reader"
  description  = "Read only access to a select subset of resources."
  instance_arn = local.sso_instance_arn
  tags = {
    description = "Read only access to a select subset of resources."
  }
}

resource "aws_ssoadmin_permission_set_inline_policy" "reader" {
  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.reader.arn
  inline_policy      = module.aws_core_permissions.reader_policy_json
}

###########################################################################
## Permission to Account Bindings
###########################################################################
module "permission_bindings" {
  for_each                     = var.environment_access_map
  source                       = "../../modules/aws_sso_permission_binding"
  sso_instance_arn             = local.sso_instance_arn
  identity_store_id            = local.identity_store_id
  environment                  = each.key
  aws_account_id               = each.value.account_id
  superuser_groups             = each.value.superuser_groups
  admin_groups                 = each.value.admin_groups
  reader_groups                = each.value.reader_groups
  superuser_permission_set_arn = aws_ssoadmin_permission_set.superuser.arn
  admin_permission_set_arn     = aws_ssoadmin_permission_set.admin.arn
  reader_permission_set_arn    = aws_ssoadmin_permission_set.reader.arn
}
