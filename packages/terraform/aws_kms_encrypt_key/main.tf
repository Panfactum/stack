// Live

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "5.39.1"
      configuration_aliases = [aws.secondary]
    }
  }
}

data "aws_region" "primary" {}
data "aws_region" "secondary" {
  provider = aws.secondary
}

###########################################################################
## Access policy
###########################################################################
data "aws_caller_identity" "current" {}
data "aws_iam_policy_document" "key" {
  statement {
    effect = "Allow"
    principals {
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
      type        = "AWS"
    }
    actions   = ["kms:*"]
    resources = ["*"]
  }

  statement {
    effect = "Allow"
    principals {
      identifiers = concat(["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"], var.admin_iam_arns)
      type        = "AWS"
    }
    actions = [
      "kms:Create*",
      "kms:Describe*",
      "kms:Enable*",
      "kms:List*",
      "kms:Put*",
      "kms:Update*",
      "kms:Revoke*",
      "kms:Disable*",
      "kms:Get*",
      "kms:Delete*",
      "kms:TagResource",
      "kms:UntagResource",
      "kms:ScheduleKeyDeletion",
      "kms:CancelKeyDeletion",
      "kms:ReplicateKey",
      "kms:UpdatePrimaryRegion"
    ]
    resources = ["*"]
  }

  statement {
    effect = "Allow"
    principals {
      identifiers = concat(
        ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"],
        var.admin_iam_arns,
        var.user_iam_arns
      )
      type = "AWS"
    }
    actions = [
      "kms:Encrypt",
      "kms:Decrypt",
      "kms:ReEncrypt*",
      "kms:GenerateDataKey*",
      "kms:DescribeKey"
    ]
    resources = ["*"]
  }

  statement {
    effect = "Allow"
    principals {
      identifiers = concat(
        ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"],
        var.admin_iam_arns,
        var.user_iam_arns
      )
      type = "AWS"
    }
    actions = [
      "kms:CreateGrant",
      "kms:ListGrants",
      "kms:RevokeGrant"
    ]
    resources = ["*"]
    condition {
      test     = "Bool"
      values   = ["true"]
      variable = "kms:GrantIsForAWSResource"
    }
  }
}

###########################################################################
## Primary Key
###########################################################################

resource "aws_kms_key" "key" {
  description              = var.description
  key_usage                = "ENCRYPT_DECRYPT"
  customer_master_key_spec = "SYMMETRIC_DEFAULT"
  deletion_window_in_days  = 30
  is_enabled               = true
  multi_region             = true
  policy                   = data.aws_iam_policy_document.key.json
}

resource "aws_kms_alias" "alias" {
  target_key_id = aws_kms_key.key.key_id
  name          = "alias/${var.name}"
}

###########################################################################
## Replica Key
###########################################################################

resource "aws_kms_replica_key" "replica" {
  provider                = aws.secondary
  primary_key_arn         = aws_kms_key.key.arn
  description             = var.description
  deletion_window_in_days = 30
  enabled                 = true
  policy                  = data.aws_iam_policy_document.key.json
}

resource "aws_kms_alias" "replica_alias" {
  provider      = aws.secondary
  target_key_id = aws_kms_replica_key.replica.key_id
  name          = "alias/${var.name}"
}
