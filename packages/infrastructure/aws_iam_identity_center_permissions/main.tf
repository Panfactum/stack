terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.39.1"
    }
  }
}


locals {
  sso_instance_arn  = tolist(data.aws_ssoadmin_instances.main.arns)[0]
  identity_store_id = tolist(data.aws_ssoadmin_instances.main.identity_store_ids)[0]
}

data "aws_ssoadmin_instances" "main" {}

module "tags" {
  source = "../aws_tags"

  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  extra_tags       = var.extra_tags
  is_local         = var.is_local
}


###########################################################################
## AWS RBAC Core Permission Sets
###########################################################################

module "aws_core_permissions" {
  source = "../aws_core_permissions"
}

######################### Superuser #######################################

resource "aws_ssoadmin_permission_set" "superuser" {
  name         = "Superuser"
  description  = "Complete access to the account."
  instance_arn = local.sso_instance_arn
  tags = merge(module.tags.tags, {
    description = "Complete access to the account."
  })
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
  tags = merge(module.tags.tags, {
    description = "Read and write access to most resources."
  })
}

resource "aws_ssoadmin_permission_set_inline_policy" "admin" {
  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.admin.arn
  inline_policy      = module.aws_core_permissions.admin_policy_json
}

######################### Reader #######################################

resource "aws_ssoadmin_permission_set" "reader" {
  name         = "Reader"
  description  = "Read only access to all resources."
  instance_arn = local.sso_instance_arn
  tags = merge(module.tags.tags, {
    description = "Read only access to all resources."
  })
}

resource "aws_ssoadmin_permission_set_inline_policy" "reader" {
  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.reader.arn
  inline_policy      = module.aws_core_permissions.reader_policy_json
}

######################### Restricted Reader #######################################

resource "aws_ssoadmin_permission_set" "restricted_reader" {
  name         = "RestrictedReader"
  description  = "Read only access to a restricted subset of resources."
  instance_arn = local.sso_instance_arn
  tags = merge(module.tags.tags, {
    description = "Read only access to a restricted subset of resources."
  })
}

resource "aws_ssoadmin_permission_set_inline_policy" "restricted_reader" {
  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.restricted_reader.arn
  inline_policy      = module.aws_core_permissions.restricted_reader_policy_json
}

######################### Billing Admin #######################################

resource "aws_ssoadmin_permission_set" "billing_admin" {
  name         = "BillingAdmin"
  description  = "Read and write access to billing-related functionality."
  instance_arn = local.sso_instance_arn
  tags = merge(module.tags.tags, {
    description = "Read and write access to billing-related functionality."
  })
}

resource "aws_ssoadmin_permission_set_inline_policy" "billing_admin" {
  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.billing_admin.arn
  inline_policy      = module.aws_core_permissions.billing_admin_policy_json
}

###########################################################################
## Permission to Account Bindings
###########################################################################

module "permission_bindings" {
  for_each                             = var.account_access_configuration
  source                               = "../aws_account_permission_binding"
  sso_instance_arn                     = local.sso_instance_arn
  identity_store_id                    = local.identity_store_id
  environment                          = each.key
  aws_account_id                       = each.value.account_id
  superuser_groups                     = each.value.superuser_groups
  admin_groups                         = toset(concat(each.value.superuser_groups, each.value.admin_groups))
  reader_groups                        = toset(concat(each.value.superuser_groups, each.value.admin_groups, each.value.reader_groups))
  restricted_reader_groups             = toset(concat(each.value.superuser_groups, each.value.admin_groups, each.value.reader_groups, each.value.restricted_reader_groups))
  billing_admin_groups                 = toset(concat(each.value.superuser_groups, each.value.billing_admin_groups))
  superuser_permission_set_arn         = aws_ssoadmin_permission_set.superuser.arn
  admin_permission_set_arn             = aws_ssoadmin_permission_set.admin.arn
  reader_permission_set_arn            = aws_ssoadmin_permission_set.reader.arn
  restricted_reader_permission_set_arn = aws_ssoadmin_permission_set.restricted_reader.arn
  billing_admin_permission_set_arn     = aws_ssoadmin_permission_set.billing_admin.arn
}
